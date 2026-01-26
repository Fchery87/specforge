# SpecForge Handoff (Repo-Current)

**Updated:** January 26, 2026

This document describes how to run and validate the current SpecForge repository (Next.js + Convex + Clerk), including the live generation streaming + cancel flow.

---

## Quickstart

### Prerequisites

- Node.js 18+
- A Convex project (for `convex dev`)
- Clerk keys (for auth)

### Install

```bash
npm install
```

### Environment

```bash
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CONVEX_ENCRYPTION_KEY`
- `NEXT_PUBLIC_CONVEX_URL` (set by Convex dev)

### Run (two terminals)

```bash
# Terminal 1
npm run convex

# Terminal 2
npm run dev
```

---

## Live Generation (Streaming) + Cancel

### What “streaming” means here

SpecForge uses **pseudo-streaming**: generation runs in short continuation turns and flushes partial artifact content to Convex periodically. The UI subscribes via reactive queries and renders a live preview.

### Where it lives

- Backend worker: `convex/internalActions.ts`
- Incremental persistence: `convex/internal.ts` (`appendPartialContentToArtifactInternal`)
- Cancel mutation: `convex/artifacts.ts` (`cancelArtifactStreaming`)
- Phase artifact query: `convex/artifacts.ts` (`getArtifactByPhase`)
- Live preview UI: `app/project/[id]/phase/[phaseId]/page.tsx` + `components/streaming-artifact-preview.tsx`

### How to verify manually

1. Open a project phase page (e.g. Brief/PRD/etc.)
2. Click “Generate Phase”
3. Confirm “Live” preview content updates while generation is running
4. Click “Cancel”
5. Confirm:
   - generation stops
   - “Cancelled” status appears
   - partial output remains visible and preserved

---

## Verification

```bash
npm run typecheck
npm run lint
npm run test -- --run --testTimeout=20000
```

---

## Notes

- This repo supports both `npm` and `bun`, but documentation/examples default to `npm` because the project includes `package-lock.json`.

