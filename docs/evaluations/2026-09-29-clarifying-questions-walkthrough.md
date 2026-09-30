# Clarifying questions walkthrough

**Date:** 2026-09-30
**Spec:** [Clarifying questions](../specs/2026-09-29-clarifying-questions.md)
**Deployment:** Convex dev (`impartial-raccoon-899`), model `deepseek-flash` through the system credential

## Method

The functions were driven from the CLI with `npx convex run --identity`, acting as the dev user,
on a throwaway Full project ("Walkthrough: clarifying questions", deleted afterwards). Every step
ran the production paths: `generateQuestions`, `saveAnswer`, `generateAllQuestionAnswers`,
`generatePhase`. The panel was checked against `/design` fixtures
(`design/screens/questions/`), not in a signed-in browser.

The project description says invitations can be accepted only by the person they were sent to and
expire after seven days, and that the app is a modular monolith on Next.js and Convex.

## Defects the run found

1. **Reasoning models never returned questions.** `generateQuestions` capped the reply at 2,000
   tokens. `deepseek-flash` spends that thinking, returns no content, and the reasoning text was
   parsed in its place. The result was the generic fallback list for every project, with empty
   `feeds`, exactly as before this phase. It is fixed by sizing the reply from the model
   (`replyTokensFor`, a quarter of the context, at least 8,000 tokens). The single-answer
   suggestion, the batch answerer and Stress-Test had the same cap and follow the same rule.
2. **"Let AI answer all" overwrote answers a person had typed.** It re-answered every question, and
   under the new origin model that would have relabelled a typed answer `drafted`. The batch now
   skips an answer a person typed or kept and still redrafts an unreviewed one, so "Refresh
   suggestions" keeps working.
3. **The assumption instruction produced boilerplate.** The first Architecture document carried 50
   Assumption lines over 192 requirement bullets. 37 were one of two sentences that name nothing
   ("Assumption: This is an assistant default, not user-reviewed."), and only 13 said what was
   assumed. The prompt now asks for a line that says what is assumed and forbids one that names
   nothing. The second generation carried 12 Assumption lines, all specific, none generic.

## Questions

After the fix, Project Rules produced 6 questions and Brief 8, all about Ledger (money
representation, ledger invariants, audit policy, roles, pricing). Every `feeds` value was a real
section id. The model tagged generously: Brief questions fed 2.4 of 3 sections on average, and
Project Rules questions 2.3 of 4. Routing still narrows the answers, but a Brief section receives
most answers. The spec's risk that the model tags lazily is borne out for the three-section
phases. It is not fixed: the prompt has no example and no per-question limit.

Architecture produced 8 questions with `feeds` of 2 to 4 sections each. None re-asked a decision
from Project Rules (money, stack, styling, quality gates). One, the audit event schema, asks for
detail beyond the audit policy the rules settled, which is a follow-up rather than a repeat.

## Answers by section

With three answers typed, five drafted by "Let AI answer all", and two later typed, the final
Architecture questions routed as follows.

| Section | Answers it was pointed at |
| --- | --- |
| Architecture Overview | 4 of 8 |
| Deep Module Interfaces | 6 of 8 |
| Explicit Test Seams | 1 of 8 |
| Data Models & API Contracts | 6 of 8 |
| Deployment & Security | 3 of 8 |

Test Seams received one answer because Regenerate replaced the one question aimed at it, which the
run had blanked on purpose.

## Regenerate

After two drafted answers were blanked, Regenerate returned the six answered questions with the
same ids, text, answers and origins, byte for byte, and replaced only the two blanks with new ids
and their own `feeds`. The three typed answers were unchanged.

## Assumed answers in the document

Three answers were typed and five drafted. The Architecture document marked the drafted decisions
as assumptions and, in the better lines, separated the two: "the reviewed requirement is only that
the verified email matches" beside "the token as lookup key is an assistant default". After the
instruction was tightened, the second document had 12 Assumption lines and 344 requirement bullets.

## Backfill

On dev the backfill migrated 24 phases, 136 questions and 2 evidence sources. A second run changed
nothing. Afterwards no question carried `aiGenerated`, every one had `source`, `feeds` and
`required`, every answer had an origin, and question text and answers were unchanged. 96 of the 108
answers became `accepted` (the flag could not tell a chosen suggestion from a batch fill), 12
`user`. That is the assumption the spec states, and it means most existing answers keep reading as
decisions rather than as assumptions.

## Not covered

- The panel was not driven in a signed-in browser. The fixtures and the component tests cover it.
- Production has not been backfilled. The schema now rejects a question that lacks the new fields,
  so the backfill has to run there before this deploys.
- Whether the requirement-quality report counts assumed requirements as weaker was not checked.
