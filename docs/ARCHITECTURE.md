# SpecForge Architecture

**Version:** 1.1  
**Date:** January 10, 2026  
**Tech Stack:** Next.js 16 (App Router) · Convex (Free Tier) · Clerk Auth · Multi‑LLM Backend

---

## 1. System overview

SpecForge transforms a project title and description into a complete, structured project handoff via a multi‑phase workflow:

```text
Brief → PRD → Specs/Architecture → Stories → Artifacts → Handoff + ZIP Export
```

### Core guarantees

- **No truncation:** Chunked generation with model‑aware `max_tokens` per model.
- **Multi‑tenant:** System vs. user LLM/MCP credentials.
- **Real‑time UX:** Convex queries and mutations for live updates.
- **Free‑tier friendly:** Text content in Convex DB; one ZIP per project in Convex file storage.

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

> Conceptual example for clarity — adjust types/fields as your implementation evolves.

```ts
// convex/schema.ts (conceptual)

export default schema({
  projects: table({
    userId: v.string(), // Clerk user ID
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("complete")
    ),
    phases: v.array(
      v.object({
        id: v.string(), // "brief", "prd", "specs", "stories", "handoff"
        name: v.string(),
        status: v.string(), // "pending", "generating", "ready", "error"
        questions: v.array(
          v.object({
            id: v.string(),
            text: v.string(),
            answer: v.optional(v.string()),
            aiGenerated: v.boolean(),
          })
        ),
        artifactIds: v.array(v.id("artifacts")),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    zipStorageId: v.optional(v.id("_storage")), // Project ZIP storage id
  }),

  artifacts: table({
    projectId: v.id("projects"),
    phaseId: v.string(),
    storyId: v.optional(v.string()),
    type: v.string(), // "brief", "prd", "spec", "story", "doc", "handoff"
    title: v.string(),
    content: v.string(), // Full Markdown (DB text)
    previewHtml: v.string(), // Rendered HTML for UI
    sections: v.array(
      v.object({
        name: v.string(),
        tokens: v.number(),
        model: v.string(),
      })
    ),
  }),

  userLlmConfigs: table({
    userId: v.string(),
    provider: v.string(),
    apiKey: v.bytes(), // Encrypted user key
    defaultModel: v.string(),
    maxTokens: v.number(),
  }),

  systemLlmConfigs: table({
    provider: v.string(),
    models: v.array(
      v.object({
        id: v.string(),
        maxOutputTokens: v.number(),
        contextTokens: v.number(),
        defaultMax: v.number(),
      })
    ),
  }),
});
```

**Design intent:** keep artifacts as text in the database to minimize file storage usage, and store **a single ZIP** per project in Convex file storage for export.

---

## 4. Key backend workflows

### 4.1 Project lifecycle

#### Create project

- **Input:** `title` (≤ 100 chars), `description` (≤ 5000 chars)
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

This approach avoids relying on a single long LLM response and stays robust across model token limits.

---

## 5. Frontend architecture (Next.js 16)

### 5.1 Routes

```text
app/
├── layout.tsx                      // Clerk + Convex providers
├── (app)/
│   ├── dashboard/page.tsx          // Project list
│   ├── project/[id]/page.tsx       // Project overview
│   ├── project/[id]/phase/[phaseId]/page.tsx // Phase UI
│   ├── settings/llm/page.tsx       // User LLM/MCP settings
│   └── admin/dashboard/page.tsx    // Super admin
```

- Uses App Router and React Server Components where possible.
- Phase pages use Convex hooks for live updates of status and artifacts.

### 5.2 UX patterns

#### Phase page

- **Top:** phase name, status, expected outputs.
- **Middle:** questions with options:
  - Manual answer
  - “AI answer this question”
  - “AI answer all unanswered questions in this phase”
- **Bottom:** artifacts list with inline preview and “Download Markdown”.

#### Downloads

- **Single artifact:** create a Blob from `content` and trigger browser download (no file storage bandwidth).
- **Full project:** call backend to get a signed URL for `projects.zipStorageId` and navigate to it once (counts toward Convex file bandwidth).

---

## 6. Auth, multi‑tenancy, and secrets

- Clerk manages user identities and roles (user vs. super admin).
- Convex receives validated tokens and enforces `userId` scoping on all reads/writes.
- System LLM/MCP keys live in environment variables and are used only in backend actions.
- User keys are stored **encrypted** in `userLlmConfigs` and never returned to the client or logs.

---

## 7. Deployment and limits

- Next.js 16 deployed on a platform like Vercel.
- Convex free tier used for:
  - Up to **0.5 GB** DB (text artifacts and metadata)
  - Up to **1 GB** file storage (ZIPs)
  - Up to **1 GB/month** file bandwidth (full project downloads)

Monitor:

- Storage usage
- Number of projects
- Downloads per month

---

## 8. Future extensions

- Additional artifact types (e.g., test plans, onboarding docs).
- Optional external storage (Cloudflare R2, Vercel Blob) if Convex file limits become restrictive.
- Team collaboration (shared projects) and commenting on artifacts.

---

> Save this as `ARCHITECTURE.md` at the root of the SpecForge repo and iterate from there.
