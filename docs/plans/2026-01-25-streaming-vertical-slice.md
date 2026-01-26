# Real-Time Streaming Generation (Vertical Slice) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make phase generation visibly “stream” by incrementally persisting partial artifact content during generation so the UI can update via Convex reactive queries.

**Architecture:** Implement backend “pseudo-streaming” by generating output in short continuation turns (small `maxTokens`) and flushing to Convex on each turn (or every N tokens). This avoids true provider streaming while still producing frequent updates. Add artifact streaming fields to schema and internal mutations to manage stream state.

**Tech Stack:** Convex (internal mutations/actions), TypeScript, existing LLM clients (`lib/llm/providers/*`), `continueIfTruncated` continuation helper.

**Status (Jan 2026):** Implemented in this repository (streaming persistence, cancel, live preview UI, and preview throttling).

---

## Current State (Codebase Reality Check)

- Generation today is **per-section**: `convex/internalActions.ts` generates a whole section, then appends once via `internal.appendSectionToArtifactInternal`.
- LLM providers do **non-streaming** HTTP calls (`complete()`), but responses include `finishReason` (OpenAI-compatible normalizer) and there is a continuation loop helper `lib/llm/continuation.ts`.
- UI subscribes to artifacts via reactive queries (phase pages fetch artifacts list), but artifacts only change when a section finishes.

This plan focuses on the vertical slice backend changes to make artifacts change repeatedly during generation.

---

## Task 1: Add streaming fields + indexes to `artifacts`

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Update `artifacts` table**

Add optional streaming fields:
- `streamStatus`: `'idle' | 'streaming' | 'paused' | 'complete' | 'cancelled'`
- `currentSection`: string
- `sectionsCompleted`: number
- `sectionsTotal`: number
- `tokensGenerated`: number

Add a compound index to efficiently find the artifact for `(projectId, phaseId)`:
- `.index('by_phase', ['projectId', 'phaseId'])`

**Step 2: (Optional) Add `createdAt` to artifacts**

Current UI expects `createdAt?` in `components/artifact-preview.tsx`; it’s optional today. If you want deterministic ordering, add:
- `createdAt: v.number()`

and ensure inserts set it.

**Step 3: Verify schema deploy**

Run: `npm run convex`
Expected: schema loads without errors.

---

## Task 2: Add an internal mutation to append partial content

**Files:**
- Modify: `convex/internal.ts`

**Step 1: Add `appendPartialContentToArtifactInternal`**

Create a new `internalMutation` that:
- Locates the artifact by `(projectId, phaseId)` (use the new `by_phase` index).
- If missing, creates a placeholder artifact with:
  - `content: ''`, `previewHtml: ''`, `sections: []`
  - `type` and `title` similar to `appendSectionToArtifactInternal`
  - streaming fields set (`streamStatus: 'streaming'`, `sectionsTotal`, etc.)
- If present, patches:
  - `content` (append `deltaContent`)
  - `previewHtml` (either append rendered delta, or recompute from full markdown for correctness)
  - `tokensGenerated` (increment)
  - `currentSection`, `sectionsCompleted`, `sectionsTotal`, `streamStatus` (as provided)

Suggested signature:
```ts
appendPartialContentToArtifactInternal: internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    deltaContent: v.string(),
    tokensGeneratedDelta: v.number(),
    currentSection: v.optional(v.string()),
    sectionsCompleted: v.optional(v.number()),
    sectionsTotal: v.optional(v.number()),
    streamStatus: v.optional(
      v.union(
        v.literal('idle'),
        v.literal('streaming'),
        v.literal('paused'),
        v.literal('complete'),
        v.literal('cancelled')
      )
    ),
  },
  handler: async (ctx, args) => { /* ... */ },
});
```

**Step 2: Decide preview strategy**

Two acceptable approaches:
1) **Correctness-first:** `previewHtml = renderPreviewHtml(fullContent)` on each flush (costlier).
2) **Performance-first:** append `renderPreviewHtml(deltaContent)` (may produce malformed HTML while markdown is incomplete).

Vertical slice recommendation: start with (1) to keep UI stable; optimize later with throttling.

---

## Task 3: Make `continueIfTruncated` support per-turn callbacks

**Files:**
- Modify: `lib/llm/continuation.ts`

**Step 1: Add `onTurn` callback support**

Extend `continueIfTruncated` with an optional callback invoked after each `complete()`:
```ts
onTurn?: (args: {
  turn: number;
  delta: string;
  aggregated: string;
  finishReason?: string;
}) => Promise<void> | void;
```

Implementation detail:
- Track `prevContentLength` (or keep the last response content as `delta`) so you can pass `delta` without diffing strings.
- Call `onTurn` immediately after appending the new delta into `content`.

**Step 2: Keep the existing API working**

All existing call sites should still compile; make `onTurn` optional.

---

## Task 4: Add a “streaming section generation” helper

**Files:**
- Modify: `convex/actions/generatePhase.ts`

**Step 1: Introduce `generateSectionContentStreaming`**

Create a sibling helper to `generateSectionContent` that:
- Uses `continueIfTruncated` but intentionally sets `maxTokens` small (e.g. 200–400) so turns are frequent.
- Uses a higher `maxTurns` (e.g. 12–20) to finish a section.
- Provides an `onChunk` callback for flushing to DB via the worker.

Suggested signature:
```ts
export async function generateSectionContentStreaming(params: {
  /* same as generateSectionContent */
  chunkMaxTokens: number;
  maxTurns: number;
  onChunk: (delta: string, finishReason?: string) => Promise<void>;
}): Promise<{ content: string; continued: boolean }>;
```

**Step 2: Use telemetry for duration**

Keep the existing `logTelemetry` calls; optionally log per-turn timings only at debug level (avoid noisy logs).

---

## Task 5: Modify the worker to flush partial content frequently

**Files:**
- Modify: `convex/internalActions.ts`

**Step 1: Initialize stream state at worker start**

Before generation starts:
- Set artifact stream fields: `streamStatus: 'streaming'`, `sectionsTotal`, `sectionsCompleted: 0`, `tokensGenerated: 0`
- Optionally create placeholder artifact immediately (so UI can render a “starting” state).

**Step 2: For each section, generate in chunks**

Replace the single `generateSectionContent(...)` call with `generateSectionContentStreaming(...)`.

In `onChunk`:
- Call `internal.appendPartialContentToArtifactInternal` with:
  - `deltaContent` (the delta from this turn)
  - `tokensGeneratedDelta` (estimate tokens via `estimateTokenCount(delta)`)
  - `currentSection` (section name)
  - `sectionsCompleted` (currentStep)
  - `sectionsTotal` (task.totalSteps)
  - `streamStatus: 'streaming'`

**Step 3: After a section completes**

Option A (simpler): do nothing special—chunks already contain all content.

Option B (cleaner): when the section finishes, append a “section boundary” delimiter, and update `sections[]` to include per-section metadata (name/model/tokens).

Either way, ensure final artifact has:
- correct `sections[]` metadata (the UI uses it)
- `streamStatus: 'complete'` when the whole phase finishes

**Step 4: Finish / error transitions**

On success (after last step):
- Patch artifact: `streamStatus: 'complete'`, `currentSection: undefined`, `sectionsCompleted = sectionsTotal`
- Keep existing `generationTasks` and `phases` status updates.

On error:
- Patch artifact: `streamStatus: 'paused'` or `'cancelled'` (pick one), and store error somewhere (future enhancement: `lastError` field).

---

## Task 6: Add a minimal cancellation mechanism (backend-only)

**Files:**
- Modify: `convex/internal.ts`
- Modify: `convex/internalActions.ts`

**Step 1: Add `setArtifactStreamStatusInternal`**

Internal mutation to set `streamStatus` for `(projectId, phaseId)` (or by artifactId).

**Step 2: In worker, check cancellation between chunks**

Before each `complete()` turn (or inside `onTurn`), query the artifact and if `streamStatus === 'cancelled'`:
- stop further work
- mark generation task `failed` or `completed` (decision: cancelled should probably be a distinct task status later)
- keep partial content

Note: you cannot reliably abort an in-flight fetch without deeper plumbing; keeping turns small is the pragmatic v1 approach.

---

## Task 7: Add tests for the new continuation behavior

**Files:**
- Create: `lib/llm/__tests__/continuation.test.ts`

**Step 1: Test `onTurn` is called**

Write a test where `complete()` returns:
- turn 1: `{ content: "a", finishReason: "length" }`
- turn 2: `{ content: "b", finishReason: "stop" }`

Assert:
- returned content includes both deltas in order
- `onTurn` called twice with correct `delta` values

Run: `npm run test`
Expected: PASS.

---

## Verification checklist (after implementation)

Run:
- `npm run typecheck`
- `npm run lint`
- `npm run test`

Manual (dev):
- Generate a phase and observe artifact content updating multiple times during generation (not just once per section).
