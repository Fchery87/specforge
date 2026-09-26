# Stage prompts and requirement quality implementation plan

**Status:** Not started

**Spec:** [Stage prompts and requirement quality](../specs/2026-09-26-stage-prompts-and-requirement-quality.md)

## Tasks

Pure modules first, because each is testable with no Convex and no model call. Then the schema and
the runtime read, then the surface the user sees, then export. No task renames or merges a phase id,
so no project needs a data migration.

| # | Task | State | SHA | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Add `lib/llm/prompts/stages.ts` exporting `REQUIREMENTS_PROMPT`, `DESIGN_PROMPT`, `TASKS_PROMPT` and `stagePromptFor(phaseId)` built on `WORKFLOW_STAGES`. Compose it into `buildSectionPrompts` in `convex/actions/generatePhase.ts`, in the order stage prompt, section instructions, project context, questions. | Not started | — | `npx vitest --run lib/llm/prompts/__tests__/stages.test.ts` asserts each prompt states the property its documents depend on, and that a phase with a dedicated prompt module keeps it inside the stage prompt |
| 2 | Add `lib/validation/acceptance-criteria.ts` with `classifyCriterion(criterion)` returning `observable`, `unobservable` or `vague`. No model call. | Not started | — | `npx vitest --run lib/validation/__tests__/acceptance-criteria.test.ts` over a fixed corpus whose expected classes are written out, so the classifier cannot drift silently |
| 3 | Carry the class onto tickets. Add `acceptanceCriteriaQuality` as a parallel array in `convex/schema.ts`, populate it from `lib/ticket-parser.ts`, and read a criterion with no class as `unclassified` rather than labelling it retroactively. | Not started | — | `npx vitest --run lib/__tests__/ticket-parser.test.ts convex/__tests__/tickets-schema.test.ts` asserts a classed criterion, an `unclassified` legacy row, and that `acceptanceCriteria` keeps its shape for existing readers |
| 4 | Add `lib/quality/budgets.ts`: words per token ratio, a budget per section from `estimatedTokens`, a budget per stage, and the derivation written down. | Not started | — | `npx vitest --run lib/quality/__tests__/budgets.test.ts` asserts the ratio, a single-section budget, and a stage budget as the sum of its sections |
| 5 | Add `lib/quality/stage-report.ts`: `buildStageReport({ markdown, claims, sectionPlan })` returning `traceability`, `testability`, `coverage` and `length` as four separate objects with no combined score. Traceability calls `claimState` from `lib/claims.ts` rather than counting a second way. | Not started | — | `npx vitest --run lib/quality/__tests__/stage-report.test.ts` covers a fully traced stage, an untraced claim, an empty required section, a missing required section, and a stage over budget |
| 6 | Add the `stageReports` table to `convex/schema.ts` and `convex/stageReports.ts`: a query that reads a stage's artifact versions, recomputes the report and writes the row, and a mutation that does the same on demand. Both verify project ownership and resolve a version's project through its artifact. | Not started | — | `npx vitest --run convex/__tests__/stageReports.test.ts` asserts an owner read, a rejected cross-project read, a recompute when the artifact version changes, and a report for a project with no claims reporting `untraced` rather than a percentage |
| 7 | Add `components/stage-report.tsx` in the document language, render it in `components/artifact-preview.tsx` above the table of contents, mark an over-budget section where the section is, and mark a stage with an untraced requirement or an untestable criterion in `components/stage-stepper.tsx` as a word in the status text rather than a colour alone. | Not started | — | `npx vitest --run components/__tests__/stage-report.test.tsx`, then `node design/lint-tokens.mjs $(find app components -name '*.tsx')` at zero errors and a screenshot of an artifact with a report in both themes |
| 8 | Carry the report into the pack. `lib/export/agents-formatter.ts` writes the report and lists untestable criteria under their own heading; `skill-formatter.ts` follows. | Not started | — | `npx vitest --run lib/export/__tests__/agents-formatter.test.ts components/__tests__/export-options.test.tsx` asserts the report and the untestable criteria reach `AGENTS.md` |
| 9 | Gates. Full run at one revision. | Not started | — | `npm run typecheck`, `npm run lint`, `npm run test -- --run --reporter=dot --testTimeout=20000`, `npm run build`, `npm run test:e2e`, `node design/audit-contrast.mjs`, `node design/audit-token-sync.mjs`, the whole-tree palette lint and `node .keel/validate-docs-lifecycle.mjs` all exit zero |

States: `Not started`, `In progress`, `Done, unverified`, `Done`.

`Done` requires a real SHA that passes `git cat-file -t`, and a verification that
actually ran. `Done, unverified` is honest and must say what is missing.

## Notes

**Order.** Tasks 1 to 5 are pure and need no Convex or model call, so they can land and be verified
independently. Task 6 is the first that touches the database. Task 7 is the first the user sees, and
it is deliberately after the data it renders. Tasks 1 and 3 are the only two that change generation
output; the rest only observe it.

**What this plan does not do.** It does not rename, merge or remove a phase id. `phases`,
`artifacts.phaseId`, section plans and evidence records stay keyed by the eight ids, so no existing
project needs a migration and no stored artifact is rewritten. That work stays deferred for the reason
`docs/specs/2026-09-25-guided-workflow.md` gave.

**The report makes no model call.** Opening a project costs nothing and works with no LLM
credentials. This is what lets task 7 render on an artifact a user edited by hand, which is when the
report is most useful.

**Advisory, like verification.** No task blocks generation, export or a stage transition on a report
value. `docs/specs/2026-09-22-evidence-backed-specs.md` settled that for verification and the same
rule applies here: a blocked export pushes a user to invent a trace to get their pack out.

**Unrelated open item.** Phase 1's live Convex walkthrough is still pending and needs a configured
deployment plus GitHub OAuth credentials. It is not a task here and does not block this plan.

**Corrected while planning.** The spec first named `lib/llm/section-plans.ts` as the home of the
per-section instruction duplication. The instruction copy is in `getSectionInstructions` in
`convex/actions/generatePhase.ts`, overlapping the `description` on each `SectionPlanConfig`. The
spec's deletion inventory now names both.
