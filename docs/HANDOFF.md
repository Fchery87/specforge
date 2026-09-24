# SpecForge Handoff (Repo-Current)

**Updated:** September 23, 2026

This document describes how to run and validate the current SpecForge repository (Next.js + Convex + Clerk), including the live generation streaming + cancel flow.

---

## Quickstart

### Prerequisites

- Node.js 20.9+ (Node 22 recommended; npm only)
- A Convex project (for `convex dev`)
- Clerk keys (for auth)

### Install

```bash
npm ci
```

### Environment

```bash
cp .env.example .env.local
```

Required for the Next.js application:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL` (set by Convex dev)

Optional, required only for GitHub repository connection:
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

Convex backend functions do not read `.env.local`. Set the backend variables on the active deployment with the Convex CLI:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN
npx convex env set CONVEX_ENCRYPTION_KEY
```

The CLI prompts for each value. Set them on production with `npx convex env --prod set NAME`. Register the matching GitHub callback URL, `/api/github/callback`, in the GitHub OAuth app settings.

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

## Evidence-backed requirements

- `convex/projects.ts` captures answer changes as immutable evidence revisions.
- `convex/actions/scanCodebase.ts` resolves the default branch to a commit SHA; repository file sources use that commit and path.
- At artifact completion, supported requirement bullets receive stable `REQ-####` IDs. Generation may suggest source links only from the project's captured source allowlist. Suggestions start unconfirmed and the review panel can confirm or reject them.
- A new answer or repository revision marks linked requirements and tickets for review, marks their phase stale, and marks verification results that used the old source revision as outdated.
- Owners review and attach sources in the artifact page's **Requirements and evidence** panel. Project exports include a requirement traceability section.
- Quick Specs can be saved from `/dashboard/quick` into a project. They use a `quickSpec` artifact grouped under phase ID `quick`; this does not create a row in `phases`.
- Constitution output distinguishes confirmed, observed, proposed, and unresolved decisions. Locked constraints contain only confirmed project-specific rules. See the [constitution authoring guide](Constitution%20Document.md).

The local unit tests cover immutable answer revisions, source allowlist validation, change impact, and verification citation validation. A live walkthrough still requires a configured Convex dev deployment and GitHub OAuth credentials for repository scanning.

The evidence module was added to `convex/_generated/api.d.ts` locally because `npx convex codegen` could not finish its network fetch in the implementation environment. Run codegen when network access is available and review its generated changes before deploying.

---

## Notes

- Use npm with `package-lock.json` (`npm ci`) for reproducible dependency installation.
- Next.js 16's default development and production bundler is Turbopack; keep `npm run dev` and `npm run build` on the default `next dev` / `next build` commands.
