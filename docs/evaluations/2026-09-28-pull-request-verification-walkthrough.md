# Pull-request verification walkthrough

**Date:** 2026-09-28
**Spec:** [Pull-request verification](../specs/2026-09-27-pull-request-verification.md)
**Deployment:** Convex dev (`impartial-raccoon-899`); the system credential's reasoning model
(`moonshotai/kimi-k2-thinking`, 262,144-token context and output limit)

## Method

The check ran on the dev deployment through `checkPullRequest`, acting as the dev user from the
CLI, on throwaway projects that were deleted afterwards. The pull request picker was not
exercised: no GitHub OAuth app is configured on the deployments, so every check used the paste
path, which cites nothing and so infers its scope. Cited scope is covered by unit tests only.

## Run 1: a small planted change (task 7)

A project whose description says an invitation can be accepted only by its addressee and expires
after fourteen days generated a PRD of 7 requirements. A 14-line pasted diff let anyone holding the
link accept, and set the lifetime to 30 days. In 35 seconds the check marked REQ-0003 (addressee
only) and REQ-0004 (fourteen days) violated, each quoting the changed line at the right new-file
line number, and left the ledger requirements out. Both graded major: the requirements were
generated, so `proposed`.

## Run 2: a real change from this repository

A project described what #53, the claim-extraction fix, had to do: marked bullets, annotation
lines never requirements, ID citations not requirements, a wording fallback. Its PRD generated 48
requirements, all about that behaviour. The check read #53's real diff (`gh pr diff 53`, 7 files,
21 KB), and then the same diff with one planted bug: the annotation guard inverted, from
`if (terminated || METADATA_LABEL.test(label)) return null;` to
`if (terminated && !METADATA_LABEL.test(label)) return null;`.

### Three defects found and fixed

1. **The reply ran out of room.** The reply was capped at 8,000 tokens. With nothing cited, the
   model weighed all 48 requirements in its reasoning, about 30,000 tokens, and stopped at the
   limit before answering; the client fell back to the reasoning text, which is not JSON. At
   32,000 tokens it ran out again. The reply now gets a quarter of the model's context, at least
   8,000 tokens and no more than the model allows (`checkReplyTokens`), and the diff budget
   reserves the same.
2. **A length stop was retried.** Asking again with the same prompt runs out again and doubles a
   four-minute wait. A reply that stops at its limit now ends the check with a message saying to
   cite the requirements the pull request implements, or to choose a model with more room.
3. **Quoted regexes broke the JSON.** A line such as `/^\*\*(?<claimId>...)\*\*\s*/` copied into
   a JSON string without doubling its backslashes is invalid JSON, and one such quote failed the
   whole reply. `parseJsonReply` now doubles any backslash that does not start a JSON escape and
   parses again. Change drafting shares the helper and gets the same repair.

### Results after the fixes

| Diff | Time | Verdicts | Outcome |
| --- | --- | --- | --- |
| #53 as merged | 164 s | 34 met, 2 violated | Warnings, 80 |
| #53 with the planted bug | 186 s | 39 met, 3 violated, 1 other problem | Warnings, 70 |

- **The real diff.** Both violations are true to the requirements as written. The PRD stated REQ-0040 and REQ-0041 as "an unmarked document keeps only must or shall bullets", narrower than the description's "such as must or shall". The code's wording list is broader, and the check quoted it.
- **The planted bug.** REQ-0020 ("an annotation bullet is not returned") went from met to violated, quoting the inverted line at `lib/evidence.ts:61`. The check also found the consequence: REQ-0036 was violated because an ID-led `**Priority:**` bullet would now become a requirement. It reported "Annotation-label guard is inverted, so the new tests cannot pass" as another problem. One quote the model gave was not in the diff and was dropped with a note.
- **Grading.** Every violation graded major, not critical, because generated requirements are `proposed`. The report says so under each violation and links to where it can be confirmed.

## Open

- **The pull request picker has not run against GitHub.** It needs a GitHub OAuth app on the deployment. Until then it is verified against recorded API responses.
- **A reasoning model makes an uncited check slow.** Uncited checks took about three minutes on #53. Citing `REQ-` or `CHG-` IDs narrows the scope, and so the reasoning.
- **Nothing was seen in a signed-in browser.** The pages were checked through the `/design` fixtures and component tests.
