# Evidence workflow local evaluation

**Date:** 2026-09-23  
**Spec:** [Evidence-backed specifications](../specs/2026-09-22-evidence-backed-specs.md)  
**Baseline:** [Evidence workflow baseline](./2026-09-22-evidence-baseline.md)

## Fixed synthetic cases

| Case | Expected behavior | Local evidence |
| --- | --- | --- |
| Greenfield requirement with no captured source | Candidate gets an ID and remains proposed/needs review. | `convex/__tests__/evidence.test.ts` validates proposed and needs-review claim creation. |
| Requirement cites a captured answer or repository file | The exact project source ID is stored as a suggested link; it opens at the captured phase or commit path. | Source allowlist unit test; review UI renders answer and commit-pinned repository links. |
| Model emits an unknown source ID | Marker is discarded; claim remains unsupported and needs review. | Source allowlist test includes a forged ID and asserts no extra link is stored. |
| User changes an answer | A new immutable revision is added; linked claims, tickets, phase summary, and verification inputs become outdated. | Source revision impact test asserts all four records. |
| Repository rescans a different commit with unchanged file bytes | A new revision is still captured because the commit changed. | Repository revision test asserts revision 2 and retained history. |

## Local results

- Full Vitest suite: 95 files and 430 tests passed. The evidence and Quick Spec persistence tests also passed after their fixtures were tightened to avoid `any` types.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. The build reported `Next.js 16.1.1 (Turbopack)` and generated `/project/[id]/quick`.
- Baseline code capability was 0 structured evidence sources, 0 stable claim IDs, 0 validated claim links, 0 finding requirement IDs, 0 captured scan commit SHAs, and 0 saved Quick Specs.
- The implementation now supports those records and user flows. Product-level valid-link rate, false-support rate, and change-review time have not been measured against private project data.

## Limits and release gate

A live project walkthrough was not possible in this environment. Convex codegen failed on a network fetch (`ENOTFOUND` for the CLI's Sentry endpoint); the generated API declaration was updated locally by adding the new module. Regenerate it with `npx convex codegen` when network access is available, then deploy the schema and walk through the flow with Clerk. GitHub repository scanning also needs registered OAuth credentials. The local repo gates pass; the live walkthrough remains a rollout gate.
