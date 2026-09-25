# SpecForge Architecture

**Version:** 1.3
**Date:** September 23, 2026
**Tech Stack:** Next.js 16 (App Router + Turbopack) · Convex · Clerk Auth · Multi‑LLM Backend

---

## 1. System overview

SpecForge transforms a project title and description into a complete, structured project handoff via a multi‑phase workflow:

```text
Brief → PRD → Specs/Architecture → Stories → Artifacts → Handoff + ZIP Export
```

Quick Specs can also be generated separately and saved into an existing project. Project artifacts can carry requirement IDs and reviewed evidence links through tickets, exports, and pasted-diff verification.

### Core guarantees

- **Truncation control:** Chunked generation uses model-aware token budgets to reduce incomplete artifacts.
- **Multi‑tenant:** System vs. user LLM/MCP credentials.
- **Real‑time UX (pseudo-streaming):** incremental persistence + reactive queries for a live preview during generation.
- **Storage-aware:** Artifact text and metadata live in Convex; ZIP exports use Convex file storage.
- **Evidence-aware:** Captured answer and commit-pinned repository revisions can support generated claims. Model suggestions remain unconfirmed until owner review.
- **Reviewable history:** Source changes preserve prior revisions and mark affected claims, tickets, phases, and verification results for review.

---

## 2. High‑level architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js 16    │◄──►│     Convex      │◄──►│   LLM/MCP APIs   │
│  (App Router)   │    │  (Free Tier)    │    │ (OpenAI, etc.)   │
│                 │    │                 │    └─────────────────┘
│ - Phase UI      │    │ - Queries       │
│ - Settings      │    │ - Mutations     │
│ - Admin Dash    │    │ - Actions (LLM) │
│ - Auth (Clerk)  │    │ - File Storage  │
└─────────────────┘    └─────────────────┘
```

- **Next.js 16** handles UI, routing, and Clerk‑based authentication.
- **Convex** stores all project state and runs server‑side LLM calls and ZIP generation.
- **External LLM/MCP providers** are invoked only from the backend using either system or user credentials.

---

## 3. Data model (Convex schema)

`convex/schema.ts` is the source of truth. The main records are:

- **Projects and phases** hold owner-scoped project state, phase questions, answers, and phase-level staleness.
- **Artifacts and artifact versions** hold generated Markdown and revision history. `quickSpec` artifacts use the `quick` grouping key without creating a phase record.
- **Evidence sources and revisions** record answer, repository-file, and user-note snapshots with stable IDs, content digests, and bounded excerpts. Repository sources are pinned to a commit and path.
- **Claims and evidence links** connect requirement statements to artifact versions and project sources. Decision status and review status are separate; model-suggested links are not owner-confirmed.
- **Tickets** can carry requirement IDs into implementation work.
- **Verification results** preserve the artifact/source revisions and diff digest used for an advisory check.
- **Generation tasks, credentials, and project scans** support background generation, encrypted user keys, and repository context.

The schema evolves frequently. Do not copy an old schema snapshot into new code; inspect `convex/schema.ts` and generated Convex types for exact fields and indexes.

---

## 4. Key backend workflows

### 4.1 Project lifecycle

#### Create project

- **Input:** `title` (≤ 100 chars), `description` (≤ 20,000 chars)
- A mutation initializes a `projects` record with the **brief** phase in `pending` status.

#### Run phase

Users can answer clarification questions manually or let AI fill them.

A backend **action**:

1. Resolves credentials (user or system).
2. Looks up model limits from `systemLlmConfigs`.
3. Performs **chunked generation** for that phase’s artifacts.
4. Stores artifacts as:
   - Markdown (`content`)
   - HTML preview (`previewHtml`)
   - section metadata (`sections`)

#### Handoff (final phase)

Assemble:

- `handoff.md` with project overview, folder map, and a master prompt for the user’s IDE/agent.
- An in‑memory ZIP of all artifacts in a logical folder structure.

The ZIP is stored once in Convex file storage; the storage id is saved to `projects.zipStorageId` and a signed URL is retrieved on demand.

---

### 4.2 Anti‑truncation engine

For each artifact:

1. **Model lookup**  
   Read model config from `systemLlmConfigs` (e.g., `maxOutputTokens`, `defaultMax`).

2. **Section planning**  
   Choose a section plan based on artifact type, for example:
   - PRD: `["executive-summary", "epics", "requirements", "metrics"]`
   - Spec: `["overview", "requirements", "scenarios"]`
   - Story doc: `["context", "acceptance-criteria", "implementation-notes"]`

3. **Chunked generation**  
   For each section:
   - Set `max_tokens` to ~50% of `maxOutputTokens` to stay well within limits.
   - Generate sections in parallel when they are independent.

4. **Self‑critique and refinement**  
   - Run a self‑check asking whether all required points are covered.
   - If incomplete, run a refinement call using the critique as guidance.

5. **Stitch and store**  
   - Concatenate final sections into a full Markdown artifact.
   - Generate `previewHtml`.
   - Write everything into `artifacts` DB records.

This approach reduces reliance on a single long LLM response and helps handle model token limits.

---

### 4.3 Live generation (pseudo-streaming) + cancel

**Goal:** show a live preview while generation is running, and allow the user to cancel while preserving partial output.

**How it works:**

1. The phase worker runs in **short continuation turns** (small `maxTokens` per request) to produce frequent deltas.
2. The worker periodically flushes buffered deltas into the phase artifact (`content`) via internal mutations.
3. The UI subscribes to the “phase artifact” (`projectId + phaseId`) and renders `previewHtml` reactively.
4. Cancel sets `streamStatus='cancelled'`; the worker checks this between flushes and stops.

**Important implementation notes:**

- This is not provider-native token streaming; it’s incremental persistence that yields the same UX.
- `previewHtml` recomputation is throttled to avoid O(n²) re-render costs on every flush.

---

### 4.4 Clarification & Grilling Engine

**Goal:** Resolve ambiguous requirements and architectural tradeoffs early without blocking generation.

- **Question Cap:** Phase clarification questions are strictly bounded to a maximum of 10 targeted questions to prevent questionnaire fatigue.
- **AI Recommendation Engine:** Each question is generated with an explicit recommended answer and rationale.
- **Stress-Test Plan Modal:** An optional deep-dive interview session (`components/stress-test-modal.tsx`) allows users to stress-test their plan against edge cases, failure modes, and security constraints before committing to generation.

---

### 4.5 In-Browser Markdown Editor & Schema Validation Architecture

**Goal:** Provide an interactive editing and schema validation environment for artifacts directly in the browser.

- **Artifact Editor Modal (`components/artifact-editor-modal.tsx`):**
  - Four viewing modes: Edit, Preview, Split, and Schema.
  - Live token, character, and word counters with estimated reading time.
  - Reset and Save triggers with automated ticket re-parsing when saving User Stories artifacts.
- **Schema Extractor & Validation Engine (`lib/schema/phase-schema-extractor.ts`):**
  - Real-time extraction of embedded code blocks (`json`, `yaml`, `prisma`, `typescript`) and full phase schema exports.
  - Syntax error diagnostics with line and column reporting.
  - Automated conformance evaluation (conformance score badge, test seams check, error envelope check, glossary check).
  - Two-way markdown synchronization (`replaceCodeBlockInMarkdown`) that updates code block contents at exact line offsets.
- **Schema Validator Panel (`components/schema-validator-panel.tsx`):**
  - Monospace code canvas with line numbering gutter.
  - JSON and YAML format switcher with zero-dependency conversion.
  - Code block selector for embedded schemas.
  - Toolbar with Format/Prettify, Copy with toast confirmation, and Sync to Markdown.
  - One-click quick-fix insertion for test seams, RFC 7807 error envelopes, glossary tables, and tracer bullet stories.

---

### 4.6 Vertical Tracer Bullets, Deep Interfaces & Test Seams

- **Vertical Tracer Bullets:** Stories decompose into vertical slices covering frontend UI, backend API, and database layers, tagged with `sliceType='tracer_bullet'`.
- **Explicit Blocking Edges:** Tickets track `blockedByTitles` to construct an unambiguous execution dependency DAG.
- **Deep Interfaces:** Technical specs declare comprehensive TypeScript interfaces and RFC 7807 error responses rather than shallow endpoint summaries.
- **Explicit Test Seams:** All generated specs mandate unit, integration, and contract test seams.
- **Unambiguous Glossary:** Domain models generate strict term definitions, entity attributes, and business rules.

---

## 5. Frontend architecture (Next.js 16)

### 5.1 Routes

```text
app/
├── layout.tsx                              // Clerk + Convex providers
├── (auth)/
│   ├── dashboard/page.tsx                  // Project list
│   ├── dashboard/new/page.tsx              // Project creation intake
│   ├── dashboard/quick/page.tsx            // Quick Spec generation and save
│   ├── settings/
│   │   ├── page.tsx                        // User account preferences
│   │   └── llm-config/page.tsx             // User LLM API keys & model defaults
│   └── admin/
│       ├── page.tsx                        // Super-admin overview
│       ├── dashboard/page.tsx              // Admin operations dashboard
│       ├── llm-models/page.tsx             // System model catalog & provider limits
│       ├── security/page.tsx               // Security audit & encryption status
│       ├── health/page.tsx                 // Service health monitoring
│       ├── analytics/page.tsx              // Generation and token metrics
│       ├── moderation/page.tsx             // Content moderation
│       ├── users/page.tsx                  // User administration
│       ├── projects/page.tsx               // Cross-tenant project inspect
│       ├── activity/page.tsx               // Global activity log
│       └── settings/page.tsx               // System-wide parameters
├── project/[id]/page.tsx                   // Project overview & phase graph
├── project/[id]/quick/page.tsx             // Saved Quick Spec
└── project/[id]/phase/[phaseId]/page.tsx   // Interactive phase workflow
```

- Uses App Router and React Server Components where possible.
- Phase pages use Convex hooks for live updates of status and artifacts.
- Saved Quick Specs use `/project/[id]/quick`; their `quick` artifact grouping key does not create a phase row.
- Next.js 16 development and production builds use Turbopack by default. Keep `next dev` and `next build`; do not select Webpack.

### 5.2 Constitution and evidence workflow

- The constitution prompt distinguishes **confirmed**, **observed**, **proposed**, and **unresolved** decisions. Locked constraints contain only confirmed, project-specific rules.
- Standards and versions are recorded only when supplied by the user or supported by current evidence. Recommendations are labeled proposed; conformance is never claimed without verification.
- Answer updates and repository rescans create immutable evidence revisions. Generation can cite only sources included in its request; links remain suggestions until an owner reviews them.
- Changes flag linked claims, dependent tickets, phase summaries, and verification results for review. Historical records remain available.
- See [Evidence-backed specifications](specs/2026-09-22-evidence-backed-specs.md), [the implementation plan](plans/2026-09-22-evidence-backed-specs.md), and [the local evaluation](evaluations/2026-09-22-evidence-workflow-evaluation.md) for the detailed contract and current rollout limit.

### 5.3 UX patterns

#### Phase page

- **Top:** phase name, status, expected outputs.
- **Middle:** questions with options:
  - Manual answer
  - “AI answer this question”
  - “AI answer all unanswered questions in this phase”
- **Bottom:** artifacts list with inline preview and “Download Markdown”.

**Live preview:** phase pages also show a “Live” preview card while generation is running (and keep it visible after cancellation).

#### Downloads

- **Single artifact:** create a Blob from `content` and trigger browser download (no file storage bandwidth).
- **Full project:** call backend to get a signed URL for `projects.zipStorageId` and navigate to it once (counts toward Convex file bandwidth).

---

## 6. Auth, multi‑tenancy, and secrets

- Clerk manages user identities and roles (user vs. super admin).
- Convex receives validated tokens and enforces `userId` scoping on all reads/writes.
- Convex backend secrets and Next.js server secrets are configured in their respective environments; GitHub OAuth secrets stay server-side.
- User keys are stored **encrypted** in `userLlmConfigs` and never returned to the client or logs.

---

## 7. Deployment and limits

- Next.js 16 deployed on a platform like Vercel.
- Convex deployment variables are configured with the Convex CLI, separately from Next.js `.env.local`.
- Limits depend on the selected Convex plan. Monitor database/storage use and export traffic against the active plan rather than relying on fixed quota figures in this document.
- GitHub OAuth is optional for repository connection; callback URLs must match each environment.

---

## 8. Future extensions

- Additional artifact types (e.g., test plans, onboarding docs).
- Optional external storage (Cloudflare R2, Vercel Blob) if Convex file limits become restrictive.
- Team collaboration (shared projects) and commenting on artifacts.

---
