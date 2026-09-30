# Clarifying questions that reach the spec

**Date:** 2026-09-29
**Roadmap:** Phase 10, [Clarifying questions](../roadmap.md)

## Problem

Every phase page opens with Questions & Clarifications. The answers are meant to shape the document
that phase generates. Reading the code shows five places where they do not.

1. **The question generator is told the wrong sections.** A phase's sections are defined five times,
   and the copies disagree:

   | Table | Path | Used for |
   | --- | --- | --- |
   | `getSectionPlan` | `lib/llm/chunking.ts` | The sections actually generated |
   | `getSectionInstructions` | `convex/actions/generatePhase.ts` | What each generated section covers |
   | `SECTION_PLANS_BY_PHASE` | `lib/llm/section-plans.ts` | The phase page, stage reports, quality budgets |
   | `PHASE_CONTEXT` | `convex/actions/generateQuestions.ts` | What the question prompt says the phase will generate |
   | `sectionKeywords` | `convex/internalActions.ts` | Which answers are pinned to a section as its own |

   `chunking.ts` was cut to fit the Convex action timeout, and the other tables were not updated.
   The question prompt now names sections that are never generated for six of eight phases. It asks
   Brief about `target-audience`, Tasks about `acceptance-criteria`, and Export about
   `implementation-guide`. For Architecture it names five sections and only `architecture-overview`
   is real. For Schemas none of its four names is real. The phase page previews sections from
   `section-plans.ts`, so it shows Architecture sections called `data-models` and `api-design` that
   are generated as `data-models-and-api`.

2. **Answers reach a section by keyword.** `extractRelevantQuestionsForSection` in
   `convex/internalActions.ts` scores each answer by whether its text contains a word such as
   "deploy" or "entity". Eight generated sections have no keyword entry (`domain-glossary`,
   `deep-modules`, `test-seams`, `data-models-and-api`, `deployment-and-security`, `documentation`,
   `configuration`, `deployment-guide`), so each receives every answer in the project, upstream
   phases included. The sections that do have entries get whatever matches a word. A question and answer
   about "who can sign in" that never say "auth" or "security" would miss the security section.

3. **Regenerate deletes answers.** `generateQuestions` writes a fresh list with every answer empty,
   and `updatePhaseQuestionsInternal` replaces the stored array. That array also holds the answers
   merged in from Stress-Test. The `grillSession` counter survives, so the badge can read "6/10"
   after the six answers are gone. There is no confirmation.

4. **Evidence history joins unrelated questions.** Question IDs are positional (`brief-q1`), and an
   answer's evidence source is keyed `answer:${phaseId}:${questionId}`. After a regenerate, `brief-q1`
   is a different question, and its first answer is filed as revision 2 of the old question's answer.

5. **An answer the model wrote reaches the model as the user's requirement.** "Let AI answer all"
   and a one-click suggestion both save answers the user may never have read. Evidence records these
   as `origin: 'assistant'`, but `formatQAForPrompt` renders every pair under "User Requirements &
   Clarifications". The phase's own `aiGenerated` flag cannot help, because it means two things. On
   a question it records that the model wrote the question. After `saveAnswer` it records that the
   model wrote the answer. `mergeGrillAnswersIntoQuestions` sets it to `false` even when the user
   accepted the model's recommendation.

Three smaller defects share the same code:

- `selectQuestions` discards the model's questions and uses the generic fallback list whenever the
  model returns fewer than the phase minimum. Three good Architecture questions become five generic
  ones, including a question about the tech stack that Project Rules already settled.
- The question prompt says "do not ask questions already decided", but it sees only upstream Q&A
  and the locked constraints, never the requirements the upstream documents produced. It reads direct
  dependencies only.
- Stress-Test tells the model to recommend "2026 production-grade standards (tracer bullets, deep
  interfaces…)" for every project. A phase with no fallback list borrows the Architecture list. When
  the model fails, the recommended answer is the literal text "Standard production practice", and one
  click saves it as the user's answer.

Credential resolution, the upstream-context builder and the description truncation are copied into
`generateQuestions`, `generateGrillRound` and `generatePhase`, so each of these fixes would otherwise
have to be made three times.

## Goal

Each phase has one list of sections, and every question names the sections it informs. Generation
gives each section exactly the answers that name it. Answers survive regeneration under stable IDs.
The prompt separates what the user decided from what the model assumed.

## Non-goals

- **Merging Stress-Test into the main question list.** Two question surfaces for one job is a real
  cost, but whether Stress-Test stays a modal is a product call for the owner, not a defect. This
  phase fixes what Stress-Test writes, not where it lives.
- **Changing which sections a phase generates.** The generated set in `chunking.ts` becomes the one
  list as it stands. Restoring sections that were cut for the action timeout, such as
  `acceptance-criteria`, is separate work.
- **Pre-filling answers from upstream documents.** Showing "From PRD, confirm or edit" in place of a
  question is a natural next step once questions can see upstream requirements. It is not built here.
- **Changing the evidence model.** Evidence sources, revisions and claim links keep their shape. Only
  the key an answer is filed under changes, because the question ID it contains becomes stable.
- **Staleness of questions.** When an upstream answer changes, downstream questions are not flagged.
  Phase staleness already covers the documents.

## Approach

### Data shape

One registry owns a phase's sections. It is built from the generated set in `chunking.ts`, the
instructions in `getSectionInstructions`, and the titles, descriptions and budgets in
`section-plans.ts`.

```ts
// lib/specification/phase-sections.ts
export interface PhaseSection {
  id: string;                  // 'deep-modules'
  title: string;               // 'Deep modules'
  description: string;         // what the section decides; shown on the phase page and in the question prompt
  instructions: string;        // what the section must cover; given to the generation prompt
  estimatedTokens: number;
  required: boolean;
  sectionType: 'documentation' | 'technical' | 'implementation' | 'planning';
}

export const PHASE_SECTIONS: Record<PhaseId, readonly PhaseSection[]>;
export function sectionIdsFor(phaseId: PhaseId): readonly string[];
```

A phase question gains the sections it feeds, a stable ID, where it came from, and who wrote its
answer. `aiGenerated` is removed, because it meant two things.

```ts
type AnswerOrigin =
  | 'user'       // typed by the user
  | 'accepted'   // written by the model, then chosen by the user: a suggestion chip, a staged answer, a Stress-Test recommendation
  | 'drafted';   // written by the model and not reviewed: "Let AI answer all"

interface PhaseQuestion {
  id: string;                  // 'q_' + random, assigned once, never positional
  text: string;
  source: 'phase' | 'grill';   // replaces sniffing '-grill-' in the ID
  feeds: string[];             // section ids from PHASE_SECTIONS[phaseId]; empty means the whole phase
  required: boolean;
  suggestions?: string[];
  selectedSuggestionIndex?: number;
  answer?: string;
  answerOrigin?: AnswerOrigin; // set whenever answer is set
}
```

Editing a `drafted` answer, or pressing Keep on it, makes it `accepted`. Evidence keeps its two
values: `user` records as `user`, `accepted` and `drafted` as `assistant`.

### Flow

**Asking.** `generateQuestions`, `generateGrillRound` and the "Let AI answer all" worker share one
context builder, `buildQuestionContext(ctx, projectId, phaseId)` in `convex/lib/question-context.ts`.
It returns the locked constraints, the answered questions of every transitive upstream phase with
their origin, and the live requirements of those phases from `listLiveClaimIdsInternal`, formatted
by `formatLiveClaimsForPrompt`. Requirements rather than full documents keep the prompt bounded.
Model resolution goes through the existing `openLlmSession` in `convex/actions/llmSession.ts`,
caught so a missing credential still falls back to the base questions.

The question prompt lists the phase's sections by id and description from `PHASE_SECTIONS`. It asks
for `feeds` on every question and states that a question must inform at least one listed section.
A returned `feeds` value that is not a section id of the phase is dropped. A question left with no
valid section feeds the whole phase. Stress-Test uses the same prompt contract, so grill questions
carry `feeds` too.

**Regenerating.** Regenerate keeps every answered question as it is, and asks the model for new
questions to replace only the unanswered ones. The prompt includes the kept questions so the model
does not repeat them. If the model returns at least one valid question, those are used. The fallback
list fills only the gap below the phase minimum, and never replaces what the model returned. No
answer is deleted, so no confirmation is needed.

**Generating.** `generatePhaseWorker` builds each section's "Address these points" block from the
questions whose `feeds` contains that section, plus the questions whose `feeds` is empty. The system
prompt renders two blocks in place of "User Requirements & Clarifications":

```
Decided by the user:
Q: …
A: …

Assumed by the assistant, not reviewed by the user. Treat as a default the document may state, and
mark each requirement that depends on one as an assumption:
Q: …
A: …
```

`user` and `accepted` answers go in the first block, `drafted` answers in the second. Upstream
answers are rendered the same way, prefixed with their phase.

**Stress-Test.** The prompt asks for recommendations consistent with the project rules and upstream
documents, and drops the fixed list of house practices. A phase without a fallback list gets no
fallback questions. A question without a recommendation shows its options and no one-click accept.
The "Standard production practice" placeholder is deleted. `grillSession.totalQuestionsAsked` is
derived from the stored questions whose `source` is `grill`, so the badge cannot disagree with what
is stored.

### Migration

The schema change runs in three steps, each deployable alone.

1. Widen: add `source`, `feeds`, `answerOrigin` as optional fields. New writes set them.
2. Backfill: an internal mutation walks every phase. It assigns fresh IDs, sets `source` from the
   `-grill-` marker, sets `feeds: []`, and sets `answerOrigin` to `accepted` for answers with
   `aiGenerated: true` and `user` for the rest. It re-keys evidence sources from the old ID to the
   new one. It is idempotent: a question that already has `source` is skipped.
3. Narrow: make `source`, `feeds` and `required` required, remove `aiGenerated`, and delete the
   code that read it.

Backfilled AI answers become `accepted`, not `drafted`, because the old flag cannot tell a chosen
suggestion from a batch fill. That is an assumption in the user's favour: it keeps today's prompt
behaviour for existing projects rather than relabelling decisions the user may have made.

## Alternatives considered

- **Keep the keyword matcher and add the missing entries.** It fixes the eight empty sections today
  and breaks again at the next rename. It still misses questions that do not use the expected word.
  The model already knows which section it is asking about, so asking it to say so costs nothing.
- **Classify questions into sections in a second model call.** Correct but slower, and it moves the
  decision away from the prompt that wrote the question. Asking in the same call is one field.
- **Keep all five section tables and add a test that they agree.** It catches drift after the fact
  and leaves five places to edit for every rename. One registry makes drift impossible.
- **Confirm before Regenerate instead of merging.** It stops accidental loss but still makes the user
  choose between their answers and better questions. Merging removes the choice.
- **Hide AI answers from generation until reviewed.** Safer, but "Let AI answer all" exists so that a
  user can generate without answering. Labelling the answers keeps that path and makes the document
  say which parts are assumed.

## Deletion inventory

- `PHASE_CONTEXT` and the section list it builds in `buildQuestionPrompt`,
  `convex/actions/generateQuestions.ts`. Replaced by `PHASE_SECTIONS`.
- `getSectionPlan` in `lib/llm/chunking.ts`, and its cases in `lib/llm/__tests__/chunking.test.ts`.
  Callers read `sectionIdsFor`. `planSections`, `expandSectionsForBudget` and `estimateTokenCount`
  stay.
- `getSectionInstructions` in `convex/actions/generatePhase.ts`, and its test in
  `convex/actions/__tests__/generatePhase.test.ts`. Instructions move into the registry.
- `SECTION_PLANS_BY_PHASE`, the eight `*_SECTIONS` arrays and `getSectionPlansForPhase` in
  `lib/llm/section-plans.ts`. Its callers (`convex/stageReports.ts`, `lib/quality/budgets.ts`, the
  phase page and `app/design/page.tsx`) read the registry. The preference types in that file stay.
- `extractRelevantQuestionsForSection` and its `sectionKeywords` map in `convex/internalActions.ts`.
  Replaced by filtering on `feeds`.
- `generateSectionsWithSelfCritique` and `extractRelevantQuestions` in
  `convex/actions/generatePhase.ts`, with the `extractRelevantQuestions` tests. Neither has a caller
  today. The phase worker does this job.
- `selectQuestions` and `normalizeQuestions` in `convex/actions/generateQuestions.ts`, replaced by
  the merge described under Regenerating.
- The inline credential resolution and upstream-context building in `generateQuestions` and
  `generateGrillRound`, and the copy in `generatePhase`. Replaced by `openLlmSession` and
  `buildQuestionContext`.
- The `"Standard production practice"` fallback and the `GRILL_FALLBACK_QUESTIONS['specs']` borrow
  in `generateGrillRound`.
- The `aiGenerated` field on phase questions in `convex/schema.ts` and
  `updatePhaseQuestionsInternal`, and every read of it, after the backfill.
- The `-grill-` ID test in `resetGrillSession`, `convex/projects.ts`. It reads `source`.
- The Questions & Clarifications line in `convex/AGENTS.md` that says "10-question cap, recommended
  answers" for `generateQuestions.ts` is reworded to point at the registry.

## Verification

- `npm run test -- --run lib/specification/__tests__/phase-sections.test.ts` asserts the literal
  section ids for each phase, for example Architecture is exactly `['architecture-overview',
  'deep-modules', 'test-seams', 'data-models-and-api', 'deployment-and-security']`.
- `rg -n "PHASE_CONTEXT|sectionKeywords|getSectionPlansForPhase|getSectionInstructions|aiGenerated"
  convex lib components app` returns nothing after the narrow step.
- A test on the question prompt asserts it lists each registry section id and nothing else, and that
  a returned `feeds: ['target-audience']` on Brief is dropped to `[]`.
- A test on regenerate starts from three answered and two unanswered questions and asserts the three
  answered questions come back with the same IDs and answers.
- A test on the section prompt gives one `user`, one `accepted` and one `drafted` answer and asserts
  the literal "Decided by the user:" block holds two of them and the "Assumed by the assistant" block
  holds the third.
- A test on the backfill runs it twice over the same phase and asserts the second run changes
  nothing.
- A walkthrough on the dev deployment with a real model, recorded in `docs/evaluations/`. Create a
  Full project, answer Brief and Project Rules, and generate Architecture questions. Record each
  question's `feeds`, whether any question repeats a settled Project Rules decision, and which
  answers each generated Architecture section received. Then regenerate and confirm no answer was
  lost.

## Risks

- **The model may tag lazily.** It could put every question on every section, which restores the
  "all answers everywhere" behaviour. The walkthrough records the distribution of `feeds`. If most
  questions feed most sections, the prompt needs an example, or the limit becomes two sections per
  question.
- **The backfill touches every project's questions and re-keys evidence.** A bug there corrupts
  answer history. It runs on the dev deployment first, and the idempotence test guards reruns. Its
  counts (phases touched, questions re-keyed, evidence sources re-keyed) are logged and compared
  before production.
- **Labelled assumptions change generated documents.** Projects that relied on "Let AI answer all"
  will see requirements marked as assumptions. That is intended. The phase 4 requirement-quality
  report should be checked in the walkthrough to see whether it counts them as weaker.
- **Stage reports and budgets read the registry.** Their section lists shrink to what is actually
  generated. Budgets computed from sections that were never produced will change. This is a
  correction. Whether any report stores a budget and compares against it later has not been checked;
  if one does, it will show a one-time difference.
