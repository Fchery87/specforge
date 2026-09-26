# Stage prompts and requirement quality

**Date:** 2026-09-26
**Roadmap:** Phase 4, [Stage prompts and requirement quality](../roadmap.md)

## Problem

The three-stage workflow shipped in phase 3 presents eight phases as Requirements, Design, and Tasks,
but nothing behind the presentation changed. The user sees three stages and the system still runs
eight independent documents.

Five specific gaps.

**One prompt for eight documents.** `buildSectionPrompts` in `convex/actions/generatePhase.ts` is a
single generic instruction, "You are an expert technical writer creating project documentation.",
parameterized by `phaseId` and `sectionInstructions`. Only the constitution and the domain model have
a dedicated prompt module in `lib/llm/prompts/`. The brief, the PRD, the architecture, the tasks and
the handoff all share one instruction, so the PRD has no better idea of what a requirement is than
the brief does. A section's instructions come from `lib/llm/section-plans.ts`, which is a list of
section names and token estimates, not a statement of what the document must accomplish.

**No testable acceptance criteria.** `acceptanceCriteria` exists on tickets as `v.array(v.string())`
and is extracted by `lib/ticket-parser.ts` with a regular expression that captures bullets under a
heading. Nothing requires a criterion to be observable or falsifiable. "Should be fast" and "The
archive endpoint returns 204 for an editor and 403 for a viewer" are stored identically, and the
exported pack sends both to a coding agent as if they were equivalent.

**The readiness signal is a model's opinion, and only on half the stages.**
`lib/llm/prompts/critic.ts` scores each section 0 to 100 with `passThreshold: 80` and retries twice.
That score measures whether the prose reads like a specification. It does not measure whether the
requirements are traceable, whether a requirement states an outcome, or whether a document has a gap
in the middle. A user cannot see the score, and it is not about requirements. `shouldCritiquePhase`
gates it to `specs`, `techSpec`, `stories` and `artifacts`, so the Requirements stage, which produces
the brief and the PRD that every later document depends on, receives no critique at all.

**No length budget.** `estimatedTokens` on a `SectionPlanConfig` sizes the generation request. Nothing
constrains the length of what comes back, so a brief can arrive at 400 words or 4,000 and the
interface treats both as finished.

**The stored data describes phases, not stages.** `phases` rows, `artifacts.phaseId`, section plans
and evidence claims are all keyed by the eight phase ids. A stage is a presentation grouping computed
in `lib/workflow.ts` and has no record of its own, so nothing can be said about a stage as a whole:
not its readiness, not its length, not whether it has gaps.

## Goal

A generated document is judged on whether its requirements are usable, and the user can see that
judgement before reading.

Success is measurable:

1. Every stage has one prompt that states what its documents must accomplish, and the ten generic
   instructions in `buildSectionPrompts` are no longer the only guidance any document receives.
2. Every acceptance criterion is testable: a criterion that states no observable outcome is marked,
   and the marking survives export.
3. A document carries a requirement-quality report the user can see, and it reports four things
   separately: traceability, testability, coverage and length. A number that blends them is not
   reported.
4. A stage's report is readable as one thing, so a user sees "Design: 12 of 15 requirements traced,
   3 criteria not testable, one section over budget" rather than eight per-phase scores.
5. The exporter carries requirement quality into the pack, so a coding agent receives the same
   signal the user saw.

## Non-goals

- **Merging the eight phase ids.** `convex/schema.ts`, `convex/projects.ts`, section plans and
  evidence keep phase-keyed records. A stage gains its own record (see below) but no phase id is
  renamed, removed or merged, so no existing project needs a data migration. Renaming the eight
  phases into three is a later change, and the phase 2 spec deferred it for the same reason: the
  three-stage structure is not yet proven with users.
- **Blocking generation on a low score.** The report is advisory, exactly as
  `docs/specs/2026-09-22-evidence-backed-specs.md` makes verification advisory. A user may export an
  untraced document; they cannot do it without seeing that it is untraced.
- **A second LLM call per section to grade the first.** The report is computed from the artifact text
  and the existing claim records. `critic.ts` keeps its job and its model call.
- **Rewriting prompts for the phases that already have one.** `CONSTITUTION_PROMPT` and
  `DOMAIN_MODEL_PROMPT` stay as they are unless a test in this change shows they contradict the stage
  prompt that now wraps them.
- **Changing what a generation run produces.** No route changes, no Convex query changes shape for an
  existing caller, and no change to the chained-worker pattern.
- **Enforcing a length budget by truncation.** Over budget is reported, never cut.

## Approach

### One prompt per stage

A stage prompt is a new module in `lib/llm/prompts/`: `lib/llm/prompts/stages.ts`, exporting
`REQUIREMENTS_PROMPT`, `DESIGN_PROMPT` and `TASKS_PROMPT` alongside a `stagePromptFor(phaseId)`
lookup built on `WORKFLOW_STAGES` from `lib/workflow.ts`.

Each states the document's purpose and its failure modes, not its section list:

- **Requirements.** States an outcome a reader can verify, one obligation per requirement, no
  solution design, every requirement traceable to an answer or a file.
- **Design.** States a contract another engineer can implement against: interfaces, boundaries,
  invariants, failure behaviour, and an explicit test seam per contract.
- **Tasks.** States an end-to-end slice that a person can finish and demonstrate, with blocking edges
  and testable acceptance criteria.

`buildSectionPrompts` composes the stage prompt with the section instructions rather than replacing
them, in this order: stage prompt, then section instructions, then project context, then questions.
The stage prompt is the constant; the section instructions are the variable. A phase with a dedicated
prompt module keeps it and gains the stage prompt around it.

The three prompts are covered by unit tests that assert the properties the product depends on: the
Requirements prompt forbids solution design, the Design prompt requires a test seam, the Tasks prompt
requires testable criteria.

### Testable acceptance criteria

A pure module, `lib/validation/acceptance-criteria.ts`, classifies one criterion as one of:

| Class | Meaning | Example |
| --- | --- | --- |
| `observable` | Names a result a reader can check | "Archiving a project sets its status to archived" |
| `unobservable` | States a quality with no threshold | "Archiving should be fast" |
| `vague` | Names no subject and no outcome | "Handle edge cases" |

The classifier is deliberately small and explainable: a criterion must name a subject and a predicate
that produces a checkable result. It is not a language model, because a model's opinion of a criterion
cannot be regression-tested, and this classification appears in an exported artifact.

`lib/ticket-parser.ts` calls the classifier for each criterion it extracts and stores the class
alongside it. The ticket schema gains `acceptanceCriteriaQuality: v.array(v.string())`, parallel to
`acceptanceCriteria`, so the existing field and its consumers keep working. A criterion already
written into an existing project has no class, and reads as `unclassified` rather than being
retroactively labelled.

### The requirement-quality report

A new table, `stageReports`, holds one row per project and stage:

| Field | Type | Meaning |
| --- | --- | --- |
| `projectId` | `v.id('projects')` | Owner boundary, as everywhere else |
| `stageId` | `v.string()` | `requirements`, `design` or `tasks` |
| `artifactVersionIds` | `v.array(v.id('artifactVersions'))` | Exactly which revisions were measured |
| `traceability` | object | `total`, `traced`, `untraced` claim counts |
| `testability` | object | `total`, `observable`, `unobservable`, `vague`, `unclassified` |
| `coverage` | object | `sections`, `emptySections`, `missingSections` |
| `length` | object | `words`, `budgetWords`, `overBudget` |
| `computedAt` | `v.number()` | When the row was written |

The report is computed by a pure function, `lib/quality/stage-report.ts`, from inputs it is given:
the stage's markdown, its claim records, and its section plan. Computing it is separate from storing
it, so it is testable without Convex and re-usable by the export path.

The four dimensions are reported separately and never combined into one number. Each is a different
problem with a different fix, and a blended score would let a well-traced 4,000-word document look
the same as a badly-traced 900-word one.

- **Traceability** reads the claim records from phase 1. `untraced` is the count `claimState` already
  reports, so the report adds no second definition of the same idea.
- **Testability** reads the acceptance criteria and their classes.
- **Coverage** compares the sections present in the artifact with `lib/llm/section-plans.ts` for that
  phase, and counts a section present but containing no requirement as empty. A required section
  absent from the artifact is missing, which is the gap the current per-section generation can leave
  silently.
- **Length** compares the word count with a budget derived from the plan's `estimatedTokens`.

The report is recomputed on demand from the stored artifact version rather than on a schedule, so it
cannot describe a revision that is not the one stored, and it needs no cron job.

### Where the user sees it

- The reading surface gains a stage report above the table of contents:
  `components/stage-report.tsx`, using the document language rather than a card, with each dimension
  as a line carrying a count and a word. An over-budget section is marked where the section is, not
  only in the summary.
- `components/artifact-preview.tsx` renders the report for the stage the artifact belongs to.
- The project page's stepper marks a stage whose report has an untraced requirement or an unobservable
  criterion, so a gap is visible from the overview. The marking is a word in the stage's status text,
  not a second colour-only signal.
- The export writes the report into the pack, and `AGENTS.md` lists untestable criteria under a
  heading an agent can act on.

### Length budget

Each `SectionPlanConfig` already carries `estimatedTokens`. Length converts that estimate to a word
budget at a documented ratio, and a stage budget is the sum of its sections' budgets. The budget is a
constant in `lib/quality/budgets.ts` with its ratio and its rationale written down, because a number
with no stated derivation cannot be argued with or changed deliberately.

A document over budget is reported and exported with the fact attached. It is never truncated and
never blocked.

## Data and behaviour rules

- A report names the artifact versions it measured. When a version changes, the report is recomputed
  rather than carried forward, so a stale report is not readable as current.
- A report is advisory. It never blocks generation, export or a stage transition.
- A project with no claim records reports `untraced` counts and says so; it does not report a
  fabricated trace percentage. This is the phase 1 rule that legacy artifacts show
  `Evidence not captured` rather than invented citations.
- The classifier's output is stable for a given input. A criterion's class is not model-generated and
  is covered by a regression test with a fixed corpus.
- Report reads verify project ownership, as every other read in the project does.
- A stage report is computed from stored text. It makes no model call, so opening a project costs
  nothing and works with no LLM credentials.
- Length is reported in words, not tokens, because a token count depends on the model and a reader
  cannot see it. The budget converts once, in `lib/quality/budgets.ts`, and the conversion is stated.

## Alternatives considered

- **Ask the model to score requirement quality.** Rejected. `critic.ts` already scores a section, and
  its score is a model's opinion that cannot be regression-tested. A quality signal that appears in an
  exported artifact and in a user's decision has to be reproducible from the text.
- **Blend the four dimensions into one score.** Rejected. The four failures are independent: a
  document can be fully traced and still assert nothing checkable. One number hides which one is
  wrong, and the fix differs for each.
- **Merge the eight phases into three now.** Rejected for this change and deferred, for the reason
  phase 2 gave: it needs a migration of `phases`, `artifacts`, section plans and evidence claims keyed
  by phase id, and the three-stage structure has not been used enough to commit to that cost.
- **Enforce the budget by truncating generation.** Rejected. A truncated contract is worse than a long
  one, and the budget is a signal about the author, not a hard limit on the output.
- **Block export when a requirement is untraced.** Rejected. Phase 1 made verification advisory
  deliberately. Blocking would push a user to invent a trace to get their pack out, which is the
  failure the evidence system exists to prevent.
- **Compute the report in the generation worker.** Rejected. It would tie a pure text measurement to
  the worker lifecycle and make it unreachable for an artifact a user edited by hand, which is exactly
  when they need it.
- **Store the report on the artifact.** Rejected. A report spans every artifact in a stage, and
  storing it on one of them would create an arbitrary owner and a second copy to keep in step.

## Deletion inventory

Deleted outright, once its replacement is in place:

- The ten generic instructions in `buildSectionPrompts` that a stage prompt now states better:
  "Be thorough and detailed", "Include specific, actionable content", "Reference the project context
  throughout". The mechanical anti-reasoning rules and the output-format rules stay, because they
  guard the worker contract rather than the document's quality.
- The per-section instruction duplication between `getSectionInstructions` in
  `convex/actions/generatePhase.ts` and the `description` on each `SectionPlanConfig` in
  `lib/llm/section-plans.ts`. The two carry near-identical prose for the same section, one shown in
  the plan preview and one sent to the model, so they drift. This is a review of the eight section
  arrays and the instruction map together, not a blanket deletion, and each removal is justified in
  the commit message. Where a stage prompt now states the requirement, the per-section copy goes;
  where it describes the section's own subject such as the Mermaid diagrams the domain model
  requires, it stays.
- Any second definition of traceability. The report calls `claimState` from `lib/claims.ts`; if
  implementing it reveals a parallel count, that copy goes.

Kept and extended, not deleted:

- `lib/llm/prompts/critic.ts` and `DEFAULT_CRITIQUE_CONFIG`. The critic measures something different
  and keeps doing it.
- `lib/llm/prompts/constitution.ts` and `domain-model.ts`. They become the phase-specific layer under
  the stage prompt.
- `estimatedTokens` on `SectionPlanConfig`. It keeps sizing the request and becomes the length budget
  input.
- `acceptanceCriteria` on tickets. The new `acceptanceCriteriaQuality` array is parallel, so existing
  readers and stored rows are unaffected.
- The phase-keyed data. Nothing is renamed or merged.

## Verification

- `npm run typecheck`, `npm run lint` and `npm run test -- --run --reporter=dot --testTimeout=20000`
  exit zero.
- `lib/quality/__tests__/stage-report.test.ts` covers each dimension against a fixture with a known
  answer: a fully traced stage, a stage with an untraced claim, a stage with an empty required
  section, and a stage over its budget.
- `lib/validation/__tests__/acceptance-criteria.test.ts` holds a fixed corpus of criteria with their
  expected classes, so the classifier cannot drift silently.
- `lib/llm/prompts/__tests__/stages.test.ts` asserts each stage prompt states the property its
  documents depend on.
- A test asserts that a report whose artifact version changed is recomputed, and that a report for a
  project with no claims reports `untraced` rather than a percentage.
- A test asserts a criterion with no quality class reads as `unclassified` and is not labelled
  retroactively.
- The export tests assert the report and the untestable criteria reach `AGENTS.md`.
- `node design/lint-tokens.mjs` over the tree stays at zero errors, since the report UI is new
  surface.
- The report renders on a real generated artifact in both themes, checked with
  `node design/audit-page.mjs`.

## Risks

- **The classifier is wrong on real criteria and erodes trust in the report.** Mitigation: it reports
  a class rather than blocking, the corpus is fixed and reviewable, and a misclassification costs a
  reader a second look rather than a rejected document. Measure the false-positive rate on the fixed
  evaluation set before the report ships to every project.
- **The report reads as a grade.** A user may treat `untraced: 3` as a failure rather than a to-do.
  Mitigation: each line names the next action, and the empty state says what to do rather than
  showing a zero. Review the copy against a real first-time user.
- **The length budget is wrong for a legitimate document.** A long architecture document is not
  necessarily padded. Mitigation: the budget is reported, never enforced, its derivation is written
  down, and the first version biases toward too generous rather than too strict.
- **The stage prompt makes existing projects regenerate differently.** A user regenerating an old
  project gets a document written to a new contract. Mitigation: existing artifacts are never
  rewritten, and the report says which version it measured.
- **A fifth prompt layer is added for one phase and the composition becomes unreadable.**
  Mitigation: composition has a stated order, is one function, and is covered by a test that asserts
  the order.
