# Pull-request verification

**Date:** 2026-09-27

## Problem

SpecForge can say what a project must do, but not whether a pull request does it. The verifier that
exists today (`convex/actions/verifyImplementation.ts`, `components/verification-panel.tsx`) falls
short in six ways a reader hits directly:

1. **The diff is pasted by hand.** The panel asks for the output of `git diff origin/main...HEAD`,
   even when the project already has a connected GitHub repository with a stored token that carries
   the `repo` scope.
2. **The requirements it checks against are almost always empty.** It sends only claims whose
   `reviewStatus` is `current`. Generation creates every claim as `needs_review`, and only an explicit
   review or an applied change sets `current`. A project nobody has reviewed claim by claim is checked
   against no requirement IDs at all, and the prompt says "No validated requirement IDs were
   supplied."
3. **It checks the wrong documents.** It filters artifacts by type `constitution`, `brief`, `prd`,
   `techSpec` and `userStories`. The domain model is never included, and the spec phase's legacy
   `spec` type is missed.
4. **The verdict is a number the model picks.** The model returns an `overallScore` and a `status`.
   The code lowers the score by a fixed weight per finding, but severity is still the model's word, so
   the same diff can pass on one run and fail on the next.
5. **Large diffs are cut silently.** The prompt keeps the first 8,000 characters of the diff and the
   first 10,000 of the specification. A pull request past that limit is judged on part of its code, and
   nothing tells the reader which files went unread.
6. **A finding can cite code that isn't there.** A finding's file path is checked against the changed
   files, but nothing checks that the problem it describes appears in the diff.

It also lives in the wrong place. The panel sits on the specs and stories phase pages, but a pull
request is checked against the whole project's requirements, not one phase.

## Goal

A reader can pick a pull request, or a commit range, from the project's connected repository. They
get a verdict for each requirement the change touches, each carrying the diff lines it rests on and a
severity that follows fixed rules. A finding that cites nothing in the diff never reaches them, and
files the check didn't read are named rather than passed.

## Non-goals

- **Writing back to GitHub.** No check runs, pull-request comments or status badges. Those need a
  GitHub App with its own installation and permissions; this phase only reads.
- **Automatic runs.** No webhook and no check on push. A reader starts each check.
- **Judging code quality unrelated to a requirement.** Security and correctness problems the model
  notices outside any requirement are kept, but in a separate list, and they never set the verdict.
- **Running the code.** The check reads the diff. It does not build, run tests or execute anything.
- **Repositories other than GitHub.** GitLab and Bitbucket stay on the paste path.

## Approach

### Data shape

A check has a **source**, a **scope**, and one **verdict per requirement in scope**.

```ts
type CheckSource =
  | { kind: 'pull_request'; number: number; title: string; url: string; baseSha: string; headSha: string }
  | { kind: 'range'; base: string; head: string; baseSha: string; headSha: string }
  | { kind: 'pasted' };

type ScopeReason = 'cited' | 'change' | 'inferred';

type RequirementVerdict = {
  claimId: string;            // REQ-0012, a live claim of this project
  scope: ScopeReason;
  verdict: 'met' | 'violated' | 'incomplete' | 'not_shown';
  severity: 'critical' | 'major' | 'minor' | null;   // null for met and not_shown
  explanation: string;
  evidence: Array<{ path: string; line?: number; quote: string }>;  // quotes checked against the diff
};

type CheckCoverage = { reviewedFiles: string[]; skippedFiles: Array<{ path: string; reason: string }> };
```

A check's `status` is derived, never generated:
- `fail` when any verdict is critical;
- `warning` when any verdict is major, or any file was skipped;
- `pass` otherwise.

The stored `verificationResults` row gains optional `source`, `verdicts`, `coverage` and
`otherFindings` fields. Older rows keep their `findings`, and the history reads both shapes.

As built, the row also gains `notes` (citations that brought nothing in, and verdicts or quotes the
parser dropped), and `phaseId` became optional, since a pull-request check covers the whole project.
Applying a change marks a check without a phase outdated whenever it touches any phase; a
regeneration reaches it through `artifactVersionSet`. The table's fields are defined once, as
`verificationResultFields` in `convex/schema.ts`.

### Flow

1. **Source.** The project page gains a "Check a pull request" section beside Changes. With a
   connected repository it lists open and recently merged pull requests, and it accepts a base and
   head for a commit range. The GitHub read goes through one module, `lib/github/pulls.ts`. It fetches
   the pull request, its files with their patches (paginated), and its commit messages, or uses the
   compare API for a range. Without a repository, the paste box remains, and the source is `pasted`.
2. **Scope.** The IDs in scope come first from what the author wrote:
   - `REQ-nnnn` cited in the pull request title, body or commit messages;
   - `CHG-nnnn` cited there, which expands to the requirements that change added, reworded or
     reaffirmed.
   Only IDs that name a live claim of this project count. When nothing is cited, the model picks the
   requirements the diff touches from the live list, and each gets the scope `inferred` so the reader
   can see it was a guess. Live means not retired, whatever the review state; a claim still under
   review is checked, and the reader sees that it is unreviewed.
3. **Budget.** Files are ordered by the size of their change. Lockfiles, generated files and
   binaries are skipped with a reason. Files are added until the diff budget is reached, and every
   file beyond it is listed in `skippedFiles`. No file is cut partway.

   As built, the budget follows the model rather than being one fixed size. The reply gets a quarter
   of the model's context, at least 8,000 tokens and no more than the model's output limit
   (`checkReplyTokens`). The diff gets 90% of the context, less that reply room and the rest of the
   prompt, at three characters a token (`diffBudgetFor`). A million-token model reads about 1.9
   million characters of diff. A model whose context size is unknown gets 60,000 characters.
4. **Grading.** The prompt holds the requirements in scope under their IDs, the reviewed diff, and
   the rule that every `violated` or `incomplete` verdict quotes the diff lines it rests on. The reply
   is parsed at the boundary, as `parseDraft` does for changes:
   - a verdict for an ID that is not in scope is dropped with a note;
   - a quote that does not appear in the reviewed diff is dropped, and a verdict left with no evidence
     becomes `not_shown`;
   - an in-scope requirement the reply omits becomes `not_shown`.

   As built, `met` also needs a quote, and a quote made only of trivial lines such as `}` supports
   nothing. When nothing is cited, one call offers the model every live requirement and keeps only
   the verdicts it gives, each `inferred`; a separate call to choose the scope would double the cost
   and wait with no better guess. A reply that is not usable JSON is asked for once more. A reply
   that stopped at its output limit is not, because the same prompt runs out again; the check ends
   with a message to cite requirement IDs or choose a model with more room. A regex quoted with its
   backslashes undoubled is repaired before parsing.
5. **Severity** comes from a table in code, from the verdict and the requirement's decision status:

   | Verdict | Confirmed requirement | Proposed, observed or unresolved |
   | --- | --- | --- |
   | `violated` | critical | major |
   | `incomplete` | major | minor |
   | `met`, `not_shown` | none | none |

6. **Result.** The check page lists the verdicts, worst first. Each shows the requirement's text,
   the explanation, and the quoted lines, linked to the file on GitHub at the head commit. Below them
   come the skipped files and the other findings. A requirement or document edited after the check
   marks it outdated, as `outdatedAt` already does.

## Alternatives considered

- **Keep the 0–100 score.** A number the model chooses is not repeatable, and it doesn't say what to
  fix. Per-requirement verdicts with fixed severities are both.
- **Let the model set severity.** The same finding would be graded differently from run to run. The
  table depends only on the verdict and the requirement's status, which the reader can check.
- **Check every requirement on every pull request.** A PRD holds dozens of requirements. Most would
  come back `not_shown`, and the prompt would crowd out the diff. Cited and change-derived scope is
  exact, and inferred scope is labelled.
- **A GitHub App with check runs.** It gives an automatic status on the pull request. But it needs
  app registration, webhooks and an installation flow, and it writes to the user's repository. The
  OAuth token already stored can read everything this phase needs.
- **Trust the model's quotes.** A quoted line that is not in the diff is the one failure a reader
  cannot catch by skimming, so the parser checks each one.

## Deletion inventory

- `convex/actions/verifyImplementation.ts`: the `reviewStatus === 'current'` filter, the artifact-type
  allowlist, and the use of the model's `overallScore` and `status`. The action is rewritten around
  the new flow.
- `lib/verification/spec-checker.ts`:
  - `extractRelevantSpecs`, which includes every document whole. The prompt now carries requirements by ID.
  - `normalizeStatus` and the `overallScore`/`status` fields of the reply format.
  - The fixed 8,000 and 10,000 character slices.
  - `parseGitDiff`, which the spec first kept for the paste path. It cut each file at 5,000
    characters, which breaks the rule that no file is cut partway, so `splitUnifiedDiff` in
    `lib/verification/diff.ts` replaced it and the whole of `spec-checker.ts` was deleted.
- `components/verification-panel.tsx`, and its placement on the specs and stories phase pages in
  `app/project/[id]/phase/[phaseId]/page.tsx`. It is replaced by the project-level check section and
  check page.
- The "Copy diff command" button with `git diff origin/main...HEAD`. The paste box keeps a one-line
  hint instead.
- `overallScore` stays on the table for the dashboard's health score, computed from the verdicts'
  severities by `calculateScoreFromFindings`'s weights. It is no longer read from the model.

## Verification

- **Unit tests:**
  - scope resolution from REQ and CHG citations, including unknown and retired IDs;
  - the budget: ordering, skip reasons, no partial files;
  - the parser: out-of-scope IDs dropped, quotes checked against the reviewed diff, omitted
    requirements become `not_shown`;
  - the severity table and the derived status;
  - the GitHub module, against recorded API responses for a pull request, its files, pagination and a
    compare range.
- **Component and page tests** for the source picker, the verdict list and the history, both shapes.
- **Real model walkthrough on dev.** A throwaway project whose requirements describe a known feature
  is checked against real diffs from this repository's merged pull requests, taken with
  `gh pr diff`, through the paste path:
  - a diff that meets a requirement gets `met`;
  - a diff with a planted violation gets `violated` with a quote that exists;
  - a cited ID reaches the scope.
  The result is written up in `docs/evaluations/`.
- **The pull request picker against real GitHub.** This needs a GitHub OAuth app on the deployment,
  which is not configured today (the same gap blocks phase 1's walkthrough). Until it is, the picker
  is verified against recorded responses and the walkthrough says so.

## Risks

- **The model marks a requirement `met` that isn't.** Quote checking catches invented problems, not
  missed ones. `met` also requires a quote, and the walkthrough plants a violation to measure misses.
  A check that marks it `met` is the early signal.
- **Inferred scope misses the requirement a pull request breaks.** Labelling it `inferred` makes the
  guess visible. The page tells the reader that citing `REQ-` or `CHG-` IDs in the pull request makes
  the check exact.
- **GitHub rate limits and large pull requests.** Pagination stops at GitHub's 3,000-file limit, and
  anything past the budget is listed as skipped, so a large pull request degrades to a partial check
  that says so.
- **The stored OAuth token lacks access to an organisation's repository.** The GitHub error is shown
  as "SpecForge can't read this repository", with the reconnect link, rather than as an empty list.
- **A reasoning model spends its reply room thinking.** In the walkthrough a reasoning model weighed
  48 uncited requirements for about 30,000 tokens and stopped before answering, at both 8,000 and
  32,000 tokens of room. The reply room now follows the model, and a check that still runs out says
  so. An uncited check on such a model took about three minutes; citing IDs narrows it.
