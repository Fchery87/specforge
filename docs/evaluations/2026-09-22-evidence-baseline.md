# Evidence workflow baseline

**Date:** 2026-09-22  
**Spec:** [Evidence-backed specifications](../specs/2026-09-22-evidence-backed-specs.md)

## Method

Inspected `convex/schema.ts`, `convex/projects.ts`, `convex/internal.ts`, `convex/actions/scanCodebase.ts`, `convex/actions/verifyImplementation.ts`, `lib/verification/spec-checker.ts`, and the Quick Spec route/action. No live project data was queried or copied. No configured Convex deployment is available in this workspace for a representative project walkthrough.

## Baseline findings

| Measure | Baseline | Method |
| --- | ---: | --- |
| Structured evidence sources | 0 | No evidence source table or source revision IDs in the current schema. |
| Stable requirement claim IDs | 0 | No claim table or stable requirement ID contract in the current schema. |
| Generated claims with validated source links | 0 | Generation stores artifact text; no source-link validator exists. |
| Verification findings with stable requirement IDs | 0 | Findings have a freeform optional `specReference`; no validated requirement ID. |
| Repository scans with captured commit SHA | 0 | `projectCodebase` stores branch and scan time, not a commit SHA. |
| Saved Quick Specs in project history | 0 | Quick Spec generation returns markdown without project persistence. |

## Current paths

- Answers: `convex/projects.ts` (`saveAnswer`); internal answer writes in `convex/internal.ts`.
- Repository scan: `convex/actions/scanCodebase.ts` -> `convex/internal.ts` (`storeCodebaseInternal`).
- Artifacts and versions: `convex/schema.ts`, `convex/internal.ts`, `convex/artifacts.ts`.
- Tickets: `convex/tickets.ts`, `convex/actions/parseTickets.ts`.
- Verification: `convex/actions/verifyImplementation.ts`, `lib/verification/spec-checker.ts`, `convex/internal.ts`.
- Quick Spec: `app/(auth)/dashboard/quick/page.tsx`, `convex/actions/generateQuickSpec.ts`.

## Measurement limitation

The numeric zeroes above measure implemented data contracts, not the quality of existing artifact prose. Product rates, false support claims, and review time require a fixed project sample and live user walkthrough. Record those after source capture and review are available.
