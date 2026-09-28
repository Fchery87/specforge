# 0004. A pull-request check's grade is computed from quoted evidence, never taken from the model

**Status:** Accepted
**Date:** 2026-09-28

## Context

Phase 8 checks a pull request against the project's requirements. The verifier it replaced asked
the model for findings, a 0–100 score and a pass or fail. The score and the severity of each
finding were the model's word, so the same diff could pass on one run and fail on the next. A
finding could also describe code that was not in the diff, and nothing caught it.

A check that grades pull requests has to be repeatable and checkable by the person reading it, or
nobody can act on a failure. The walkthrough
(`docs/evaluations/2026-09-28-pull-request-verification-walkthrough.md`) showed both why and how:
the model quoted lines that were not in the diff, and on a real change it produced dozens of
verdicts that only a fixed rule could grade consistently.

## Decision

1. The model reports a **verdict** per requirement (`met`, `violated`, `incomplete`, `not_shown`)
   and the diff lines it rests on. It does not report a score, a severity or a status.
2. A verdict other than `not_shown`, `met` included, counts only if a quoted line is found in the
   reviewed diff of the named file. A quote that is not there is dropped with a note, and a verdict
   left without evidence becomes `not_shown`.
3. **Severity** comes from a table: `violated` is critical for a confirmed requirement and major
   otherwise; `incomplete` is major for a confirmed requirement and minor otherwise.
4. **Status** follows from severities: fail on any critical, warning on any major or on any file
   the check did not read, pass otherwise. The score is computed from severities too.
5. Severity stays tied to confirmation (the owner's decision). A generated requirement is
   `proposed` until someone confirms it, so a check on an unreviewed project warns rather than fails.
   The report says so under each such verdict and links to where the requirement can be confirmed.

## Alternatives

- **Keep the model's score and status.** Not repeatable, and a number does not say what to fix.
- **Let the model set severity per verdict.** The same verdict would be graded differently between
  runs; the table depends only on what the reader can see, the verdict and the requirement's status.
- **Trust the model's quotes.** A quote of code that is not in the diff is the one error a reader
  cannot catch by skimming. The check verifies each line.
- **Grade every requirement as confirmed.** Checks would fail more often, but a model's guess at a
  requirement would weigh the same as a decision someone made. The owner chose to keep the
  distinction and make confirming worth doing.

## Consequences

- The same verdicts always produce the same grade, and a reader can trace every severity to one
  table cell and every verdict to lines in the diff.
- A model that is right but quotes loosely loses verdicts: they fall to `not_shown`. A regex copied
  into JSON with undoubled backslashes lost whole replies until the parser learned to repair it.
- Missed problems are not caught by the quote check. A `met` still needs a quote, but a wrong `met`
  with a real quote passes. The walkthrough's planted bug was caught; that is one sample, not a rate.
- Until requirements are confirmed, no check fails. A project that never reviews its requirements
  gets warnings, not failures, from every pull request.

## Revisit when

- Checks run automatically on pull requests (a GitHub App with check runs). An unreviewed project
  that never fails would then never block a merge, and grading unconfirmed requirements as confirmed
  may be the better default there.
- A model can return structured output with verified spans, making the line-by-line quote check
  redundant.
