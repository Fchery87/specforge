# Pull-request verification

**Status:** Not started

**Spec:** [Pull-request verification](../specs/2026-09-27-pull-request-verification.md)

## Tasks

The pure core comes first. Tasks 1 to 4 are plain functions in `lib/verification/` with no Convex or
network in them, so the rules (severity, scope, budget, the quote check) are pinned by literal tests
before anything calls a model. Each task lands with the gates in `.keel/config.md` at zero.

| # | Task | State | SHA | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Check types (`CheckSource`, `RequirementVerdict`, `CheckCoverage`), the severity table (verdict × decision status), the derived status, and `overallScore` computed from verdict severities | Not started | — | `lib/verification/__tests__/grade.test.ts`: every cell of the table; `fail` on any critical, `warning` on any major or any skipped file, `pass` otherwise |
| 2 | Scope resolution: read `REQ-nnnn` and `CHG-nnnn` from the pull request title, body and commit messages; keep IDs that name live claims; expand a CHG to the claims its ops added, reworded or reaffirmed; report unknown and retired IDs as notes | Not started | — | `lib/verification/__tests__/scope.test.ts`: a cited REQ, a CHG expanding to its claims, an unknown ID, a retired ID, and no citations (empty scope, so the check infers) |
| 3 | Diff budget: order files by size of change, skip lockfiles, generated files and binaries with a reason, add whole files until the budget, list the rest as skipped; `parseGitDiff` feeds the same shape for the paste path | Not started | — | `lib/verification/__tests__/budget.test.ts`: order, each skip reason, no file cut partway, a pasted diff split into the same file shape |
| 4 | Grading prompt and parser: requirements in scope by ID (or the live list, capped, when scope is empty, with `inferred` on what the model picks), the reviewed diff, and the quoting rule; the parser drops out-of-scope IDs, drops quotes absent from the reviewed diff, turns an unevidenced verdict and an omitted requirement into `not_shown`, and keeps other findings apart | Not started | — | `lib/verification/__tests__/parse-check.test.ts` with literal replies: an invented quote, an out-of-scope ID, an omitted requirement, a `met` with no quote, a non-requirement finding |
| 5 | GitHub module `lib/github/pulls.ts`: list open and recently merged pull requests; fetch a pull request with its files (paginated) and commit messages; compare a base and head; map 401, 403 and 404 to "SpecForge can't read this repository" | Not started | — | `lib/github/__tests__/pulls.test.ts` against recorded API responses: two pages of files, a compare range, a patchless binary file, each error status |
| 6 | Schema: optional `source`, `verdicts`, `coverage`, `otherFindings` and `notes` on `verificationResults`; the insert mutation takes them | Not started | — | `npm run typecheck`; `npx convex dev --once` pushes to dev with existing rows valid |
| 7 | `checkPullRequest` action replacing `verifyImplementation`: source (pull request, range or paste) to files, scope, budget, one model call, parse, store; owner check and rate limit kept | Not started | — | `convex/__tests__/check-pull-request.test.ts` with stubbed GitHub and model: a cited PR stores verdicts with the right severities; a paste with no citations stores inferred scope; a GitHub 404 stores nothing and returns the readable error |
| 8 | Reads: `listPullRequests` action for the picker; `listChecks` and `getCheck` queries; history renders old rows (findings and score) and new rows (verdicts) | Not started | — | Handler tests for owner checks and both row shapes |
| 9 | UI: "Check a pull request" section on the project page (pull request list, range, paste when no repository) and the check page `/project/[id]/check/[checkId]` (verdicts worst first with quoted lines linked to GitHub at the head commit, skipped files, other findings, outdated line) | Not started | — | Component and page tests; `/design` fixtures captured at 1440 and 390 in both themes |
| 10 | Delete the old path: `components/verification-panel.tsx` and its placement on the specs and stories pages, the copy-diff-command button, `extractRelevantSpecs`, `normalizeStatus` and the score and status in the reply format | Not started | — | `rg` finds no references; typecheck, lint and suite at zero; the dashboard health score still reads `overallScore` |
| 11 | Walkthrough on the dev deployment with the real model: a throwaway project whose requirements describe a known change in this repository, checked against that change's real diff from `gh pr diff`, and against the same diff with a planted violation | Not started | — | `docs/evaluations/2026-09-27-pull-request-verification.md` records: `met` on the real diff, `violated` with a quote that exists on the planted one, a cited ID reaching the scope. The pull request picker against live GitHub waits for a GitHub OAuth app on the deployment |

States: `Not started`, `In progress`, `Done, unverified`, `Done`.

`Done` requires a real SHA that passes `git cat-file -t`, and a verification that
actually ran. `Done, unverified` is honest and must say what is missing.

## Notes

- **Suggested pull requests:**
  - tasks 1 to 4 (the core);
  - tasks 5 and 6;
  - tasks 7 and 8;
  - task 9;
  - task 10;
  - task 11 with its fixes.
- **One model call, not two.** When nothing is cited, the check sends the live requirement list and
  the model returns verdicts only for what the diff touches, each marked `inferred`. A separate
  scope call would double the cost and the latency, and its guess would be no better labelled.
- **The picker needs a GitHub OAuth app.** No GitHub OAuth variables are set in `.env.local` or on
  the deployments. Until the owner registers one, task 9's picker is verified against fixtures and
  task 11 goes through the paste path.
- **Squash SHAs.** Pull requests are squash-merged, so a task's SHA is the squash commit on `main`,
  recorded in the pull request after it lands. Until then the task reads `Done, unverified`.
