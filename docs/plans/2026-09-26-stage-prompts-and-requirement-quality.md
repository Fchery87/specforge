# Stage prompts and requirement quality implementation plan

**Status:** In progress. Tasks 1, 2 and 3 of 10 are finished; tasks 4 to 10 have not started.

**Spec:** [Stage prompts and requirement quality](../specs/2026-09-26-stage-prompts-and-requirement-quality.md)

## Tasks

Pure modules first, because each is testable with no Convex and no model call. Then the schema and
the runtime read, then the surface the user sees, then export. No task renames or merges a phase id,
so no project needs a data migration.

| # | Task | State | SHA | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Add `lib/llm/prompts/stages.ts` exporting `REQUIREMENTS_PROMPT`, `DESIGN_PROMPT`, `TASKS_PROMPT` and `stagePromptFor(phaseId)` built on `WORKFLOW_STAGES`. Compose it into `buildSectionPrompts` in `convex/actions/generatePhase.ts`, in the order stage prompt, section instructions, project context, questions. | Done | 86ec93c | `npx vitest --run lib/llm/prompts/__tests__/stages.test.ts` (15 tests) asserts each prompt states the property its documents depend on, and the composition tests in `convex/actions/__tests__/generatePhase.test.ts` assert the stage reaches all three call sites, that a phase outside a stage gets none, that the universal quality rules reach every phase, and the part order. typecheck, lint and the palette lint clean. |
| 2 | Add `lib/validation/acceptance-criteria.ts` with `classifyCriterion(criterion)` returning `observable`, `unobservable` or `vague`. No model call. | Done | 86ec93c | `npx vitest --run lib/validation/__tests__/acceptance-criteria.test.ts` (51 tests) over a fixed corpus whose expected classes are written out, plus a block locking the seven defect classes a review found. A probe of the first draft found a false `observable` on "responds quickly"; the review found six more, including common specification nouns (report, record, log, display) matching the verb list. |
| 3 | Carry the class onto tickets. Add `acceptanceCriteriaQuality` as a parallel array in `convex/schema.ts`, populate it from `lib/ticket-parser.ts`, and read a criterion with no class as `unclassified` rather than labelling it retroactively. | Done | 1940a51 | `npx vitest --run lib/__tests__/ticket-parser.test.ts convex/__tests__/tickets-schema.test.ts` (3 parser alignment tests, 3 schema tests) and 5 for `criterionClasses`, which asserts a classed criterion, an `unclassified` legacy row, an unrecognised stored value, a short or long stored array, and that `acceptanceCriteria` keeps its shape for existing readers. `npx convex codegen` exits zero, so Convex accepts the schema. |
| 4 | Add `lib/quality/budgets.ts`: words per token ratio, a budget per section from `estimatedTokens`, a budget per stage, and the derivation written down. | Not started | — | `npx vitest --run lib/quality/__tests__/budgets.test.ts` asserts the ratio, a single-section budget, and a stage budget as the sum of its sections |
| 5 | Add `lib/quality/stage-report.ts`: `buildStageReport({ markdown, claims, sectionPlan })` returning `traceability`, `testability`, `coverage` and `length` as four separate objects with no combined score. Traceability calls `claimState` from `lib/claims.ts` rather than counting a second way. | Not started | — | `npx vitest --run lib/quality/__tests__/stage-report.test.ts` covers a fully traced stage, an untraced claim, an empty required section, a missing required section, and a stage over budget |
| 6 | Add the `stageReports` table to `convex/schema.ts` and `convex/stageReports.ts`: a query that reads a stage's artifact versions, recomputes the report and writes the row, and a mutation that does the same on demand. Both verify project ownership and resolve a version's project through its artifact. | Not started | — | `npx vitest --run convex/__tests__/stageReports.test.ts` asserts an owner read, a rejected cross-project read, a recompute when the artifact version changes, and a report for a project with no claims reporting `untraced` rather than a percentage |
| 7 | Add `components/stage-report.tsx` in the document language, render it in `components/artifact-preview.tsx` above the table of contents, mark an over-budget section where the section is, and mark a stage with an untraced requirement or an untestable criterion in `components/stage-stepper.tsx` as a word in the status text rather than a colour alone. | Not started | — | `npx vitest --run components/__tests__/stage-report.test.tsx`, then `node design/lint-tokens.mjs $(find app components -name '*.tsx')` at zero errors and a screenshot of an artifact with a report in both themes |
| 8 | Carry the report into the pack. `lib/export/agents-formatter.ts` writes the report and lists untestable criteria under their own heading; `skill-formatter.ts` follows. | Not started | — | `npx vitest --run lib/export/__tests__/agents-formatter.test.ts components/__tests__/export-options.test.tsx` asserts the report and the untestable criteria reach `AGENTS.md` |
| 9 | Gates. Full run at one revision. | Not started | — | `npm run typecheck`, `npm run lint`, `npm run test -- --run --reporter=dot --testTimeout=20000`, `npm run build`, `npm run test:e2e`, `node design/audit-contrast.mjs`, `node design/audit-token-sync.mjs`, the whole-tree palette lint and `node .keel/validate-docs-lifecycle.mjs` all exit zero |
| 10 | Reconcile `lib/llm/prompts/domain-model.ts`. It is imported by nothing, and it ends `Return ONLY a valid JSON object`, which contradicts the markdown-section contract every live phase uses. Either adapt its content into the domainModel section instructions or delete the module. | Not started | — | Whichever way it goes: `grep -rn "DOMAIN_MODEL_PROMPT" convex lib` returns only the module that defines it or nothing at all, and the domainModel phase still generates markdown sections in `convex/actions/__tests__/generatePhase.test.ts` |

States: `Not started`, `In progress`, `Done, unverified`, `Done`.

`Done` requires a real SHA that passes `git cat-file -t`, and a verification that
actually ran. `Done, unverified` is honest and must say what is missing.

## Notes

**Order.** Tasks 1, 2, 4 and 5 are pure and need no Convex or model call, so they can land and be
verified independently. Task 3 is the exception, and this note previously claimed it was not: it adds
a field to `convex/schema.ts` and threads it through the ticket write path, so it touches Convex even
though it makes no model call and adds no query. Task 6 is the first to add a table and a runtime read
of its own. Task 7 is the first the user sees, and it is deliberately after the data it renders. Tasks
1 and 3 are the only two that change generation output; the rest only observe it.

**Squashed SHAs.** Tasks 1 and 2 were reviewed and fixed on `feature/stage-prompts`, then landed
together as the squash commit `86ec93c` when PR #24 merged. Their individual branch commits are not in
`main`'s history, so the table names the squash commit for both. `86ec93c` passes `git cat-file -t`.

This repository squashes on merge, which means a task SHA recorded while its branch is open is not an
ancestor of `main` once the PR lands. Task 3 names `1940a51`, its branch commit, and the same
correction is therefore needed for it: the rows here are re-recorded to the squash commits once the
phase's pull requests merge, in one pass rather than a pull request per task. Anyone reading a SHA
that no longer resolves should look for the task by its commit subject instead.

**Open decision: the `artifacts` phase inherits the design prompt.** `lib/workflow.ts` puts
`artifacts` in the Design stage, so every section of that phase receives the design prompt's failure
modes — a contract with no test seam, a recorded rejected alternative — while its own section
instructions ask for documentation, configuration and a deployment guide. One section is asked to
satisfy two contracts that do not overlap. Not fixed here because `WORKFLOW_STAGES` is owned by
`docs/specs/2026-09-25-guided-workflow.md` and the stepper, the next-action resolver and the phase
labels all derive from it, so moving a phase between stages is a change to that spec's model. The
label and the sections already disagree independently: the phase reads "Schemas" while
`lib/llm/chunking.ts` gives it documentation, configuration and deployment.

**Task 4 will need a prompt-size answer, not only a document-length one.** The stage prompt adds
roughly 1,100 to 1,900 input tokens per phase (435 for Requirements, 375 for Design, 364 for Tasks),
re-sent on every continuation turn. Nothing measures it: `estimatedTokens` and `planSectionsForPhase`
count only the title, the phase description and the questions, and `estimateTokenCount` sizes output.
The risk is low because the codebase-context block dominates it by an order of magnitude and there is
no truncation path to trip, but `lib/quality/budgets.ts` should account for prompt size as well as
document length, or say explicitly why it does not.

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

**Found while implementing task 1.** `lib/llm/prompts/domain-model.ts` is imported by nothing, and its
output contract contradicts the pipeline: it ends `Return ONLY a valid JSON object`, while every live
phase flows through `buildSectionPrompts` and produces markdown sections that are merged. So it is not
the "phase-specific layer under the stage prompt" the spec assumed it was; it is a second dead module,
the same class as `lib/phase-config.ts` before the cleanup. Task 10 reconciles it. Composing it as it
stands would break the domainModel phase, which is why task 1 does not.

That finding also corrected task 1's own verification. It claimed the tests would prove "a phase with
a dedicated prompt module keeps it inside the stage prompt". The only in-stage phase with a dedicated
module is the dead one, so that claim could not be tested and was replaced with what the tests
actually assert.
