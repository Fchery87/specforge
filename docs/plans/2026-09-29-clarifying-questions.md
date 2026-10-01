# Clarifying questions

**Status:** Not started

**Spec:** [Clarifying questions](../specs/2026-09-29-clarifying-questions.md)

## Tasks

The registry comes first, because every later task reads it. The schema is widened before anything
writes the new fields, and narrowed only after the backfill has run on dev. Each task lands with the
gates in `.keel/config.md` at zero.

| # | Task | State | SHA | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Registry `lib/specification/phase-sections.ts`: `PhaseSection`, `PHASE_SECTIONS` and `sectionIdsFor`, holding the generated set from `getSectionPlan`, the text from `getSectionInstructions`, and titles, descriptions and budgets from `section-plans.ts`. Sections that `section-plans.ts` lacks (`data-models-and-api`, `deployment-and-security`, `documentation`, `configuration`, `deployment-guide`) get a title, description and budget written for them | Not started | — | `lib/specification/__tests__/phase-sections.test.ts`: the literal ids for all eight phases; every section has a non-empty title, description and instructions; ids are unique within a phase |
| 2 | Move every reader to the registry and delete the old tables: `getSectionPlan` in `chunking.ts`, `getSectionInstructions`, the `*_SECTIONS` arrays and `getSectionPlansForPhase`, `PHASE_CONTEXT`, and the dead `generateSectionsWithSelfCritique` and `extractRelevantQuestions`. Readers: `generatePhase`, `generatePhaseWorker`, `convex/stageReports.ts`, `lib/quality/budgets.ts`, the phase page, `app/design/page.tsx` | Not started | — | `rg -n "getSectionPlan\(\|getSectionInstructions\|getSectionPlansForPhase\|PHASE_CONTEXT\|extractRelevantQuestions\b" convex lib app components` is empty; stage report and budget tests updated to the generated sections, with each changed expectation named in the pull request |
| 3 | Widen the schema: optional `source`, `feeds` and `answerOrigin` on phase questions in `convex/schema.ts` and `updatePhaseQuestionsInternal`; `recommendedAnswer` optional on grill questions and in `saveGrillAnswers`. Writers set them: `saveAnswer` takes `answerOrigin` (typed is `user`, a chip or a staged answer is `accepted`), the "Let AI answer all" worker writes `drafted`, `saveGrillAnswers` writes `accepted` or `user` from `acceptedRecommendation`, and new questions carry `source` | Not started | — | `npm run typecheck`; `npx convex dev --once` pushes to dev with existing rows valid; handler tests assert the stored `answerOrigin` for each of the three writers |
| 4 | Stable question ids: `q_` plus a random id for phase and grill questions, assigned once; the evidence key `answer:${phaseId}:${questionId}` uses it unchanged | Not started | — | Handler test: generating twice gives disjoint ids; saving an answer to a regenerated question starts a new evidence source at revision 1 |
| 5 | Question prompt and parser: list the phase's sections by id and description from the registry, ask for `feeds` on each question, drop unknown section ids, and treat an empty result as the whole phase | Not started | — | `convex/actions/__tests__/generateQuestions.test.ts`: the Brief prompt names exactly Brief's registry ids; a returned `feeds: ['target-audience']` on Brief parses to `[]`; `['deep-modules', 'nope']` on Architecture parses to `['deep-modules']` |
| 6 | Regenerate as a merge: a pure `mergeRegeneratedQuestions(existing, fromModel, fallback, range)` keeps answered questions, replaces unanswered ones, and uses the fallback only to fill below the minimum; the prompt lists the kept questions. Replaces `selectQuestions` and `normalizeQuestions` | Not started | — | Tests with literal lists: three answered and two unanswered come back with the three ids and answers unchanged; one model question plus fallback fills to the minimum and keeps the model question first; model questions are never swapped for fallback ones |
| 7 | Section routing by `feeds`: a pure `answersForSection(questions, sectionId)` returns the questions tagged with the section plus the untagged ones; `generatePhaseWorker` uses it on both paths; `extractRelevantQuestionsForSection` and `sectionKeywords` are deleted | Not started | — | Unit test with four literal questions (tagged for the section, tagged elsewhere, untagged, unanswered) returns exactly the first and third; `rg sectionKeywords convex` is empty |
| 8 | Origin-aware prompt: `QAPair` carries `origin`; the serializer keeps it and still reads the old format for tasks already queued; the section prompt renders "Decided by the user" (`user`, `accepted`) and "Assumed by the assistant, not reviewed by the user" (`drafted`), with upstream pairs prefixed by phase | Not started | — | `lib/llm/__tests__/qa-serializer.test.ts` round-trips origin and parses an old-format string; a `buildSectionPrompts` test with one pair of each origin asserts the two literal blocks and which pairs each holds |
| 9 | Shared context: `convex/lib/question-context.ts` `buildQuestionContext` (locked constraints, answered questions of every transitive upstream phase with origin, and their live requirements through `formatLiveClaimsForPrompt`); `generateQuestions`, `generateGrillRound` and the answer-all worker use it and `openLlmSession`, catching a missing credential to fall back | Not started | — | Test over a fixture where Project Rules, Brief and PRD have answers and claims: the Architecture context holds all three phases' claims and answers; a handler test with no credentials still stores the base questions |
| 10 | Stress-Test fixes: the prompt asks for recommendations consistent with the project rules and upstream documents, without the fixed list of practices; no borrowed `specs` fallback; no "Standard production practice"; no one-click accept when there is no recommendation; the badge count is derived from questions whose `source` is `grill` | Not started | — | `normalizeGrillQuestions` test: a question with no recommendation or suggestions keeps `recommendedAnswer` undefined; an unknown phase gets no fallback; `components/__tests__/stress-test-modal.test.tsx` shows no accept control for such a question |
| 11 | Questions panel: a "Feeds" line under each question naming its sections by title; a `drafted` answer shows "Assumed" with a Keep action; Keep or an edit makes it `accepted`. The combined questions page shows the same | Not started | — | Component tests for the Feeds line, the Assumed marker and Keep saving `accepted`; `/design` fixtures captured at 1440 and 390 in both themes; `node design/lint-tokens.mjs` on the changed files |
| 12 | Backfill: an internal mutation that gives each phase question a stable id, `source` from the `-grill-` marker, `feeds: []`, and `answerOrigin` (`accepted` where `aiGenerated` is true, `user` otherwise), re-keys the answer's evidence sources, skips questions that already have `source`, and returns its counts | Not started | — | Test runs it twice over the same fixture and asserts the second run changes nothing; `npx convex run` on dev, with the counts (phases, questions, evidence sources re-keyed) recorded in the pull request |
| 13 | Narrow: `source`, `feeds` and `required` become required, `aiGenerated` is removed from phase questions and every reader (`question-row.tsx`, `combined-questions.tsx`, `lib/batch-answers.ts`, `lib/llm/types.ts`, the questions page), `resetGrillSession` reads `source`, and the `convex/AGENTS.md` line for `generateQuestions.ts` points at the registry | Not started | — | `npx convex dev --once` pushes to dev with every row valid after task 12; `rg -n "aiGenerated\|-grill-" convex lib components app` finds no phase-question use |
| 14 | Walkthrough on the dev deployment with the real model: a Full project with Brief and Project Rules answered, Architecture questions generated, then regenerated, then Architecture generated after "Let AI answer all" on one question | Not started | — | `docs/evaluations/2026-09-29-clarifying-questions-walkthrough.md` records each question's `feeds`, any question that repeats a Project Rules decision, the answers each Architecture section received, that Regenerate lost no answer, and where the drafted answer appears in the document |

States: `Not started`, `In progress`, `Done, unverified`, `Done`.

`Done` requires a real SHA that passes `git cat-file -t`, and a verification that
actually ran. `Done, unverified` is honest and must say what is missing.

## Notes

- **Suggested pull requests:**
  - tasks 1 and 2 (the registry);
  - tasks 3 and 4 (the widened schema and stable ids);
  - tasks 5 and 6 (asking and regenerating);
  - tasks 7 and 8 (what generation receives);
  - tasks 9 and 10 (context and Stress-Test);
  - task 11 (the panel);
  - tasks 12 and 13 (backfill, then narrow, deployed in that order);
  - task 14 with its fixes.
- **No migration framework.** The repo has none, so the backfill is a plain internal mutation run
  with `npx convex run`. If a project's phases exceed one mutation's limits, it takes a project id
  and a driver action loops over projects. That is decided when task 12 measures dev.
- **Task 2 changes stage reports and budgets.** They move from `section-plans.ts` sections to the
  generated ones. That is the correction the spec asks for, so a changed number in those tests is
  expected and is named in the pull request rather than hidden.
- **Queued tasks across deploys.** A generation task queued before task 8 deploys holds the old
  serialized Q&A. The deserializer reads it with every pair treated as `user`, which matches today's
  prompt.
- **Squash SHAs.** Pull requests are squash-merged, so a task's SHA is the squash commit on `main`,
  recorded in the pull request after it lands. Until then the task reads `Done, unverified`.
