# Change specs walkthrough

**Date:** 2026-09-27
**Spec:** [Change and bug-fix specs](../specs/2026-09-27-change-specs.md)
**Deployment:** Convex dev (`impartial-raccoon-899`), model DeepSeek through the system credential

## Method

The Convex functions were driven from the CLI with `npx convex run --identity`, acting as the dev
user, because no browser session was available. The pages themselves were checked against
`/design` fixtures (`design/screens/changes/`) and component tests, not in a signed-in browser.
Two throwaway projects were created on dev, "Walkthrough: change specs" and "Walkthrough 2: change
specs", so no existing project was touched. Every step ran the production code paths: `createProject`,
`generatePhase`, `createChange`, `draftChange`, `applyChange`, `generateProjectZip`.

Each project's description says invitations expire after one day.

## Run 1: bug fix, before the fixes below

1. The PRD generated 48 live claims.
2. A bug fix ("invitations should last seven days") drafted four edits with no dropped notes. It
   reworded REQ-0024 and REQ-0025 from one day to seven, reworded REQ-0023, a "Priority / Status"
   line that is not a requirement, and added REQ-0049, a Given/When/Then regression criterion.
3. Applying kept REQ-0024 and REQ-0025 with the new wording and marked the PRD
   "CHG-0001 applied".
4. Regenerating the PRD kept all 49 IDs (0 retired, 31 reworded in place), where text matching would
   have retired every reworded one. Two failures:
   - The model trusted the unchanged project description over REQ-0024, wrote a conflict note
     ("Both cannot hold"), and opened that note's bullet with `**REQ-0024**`, so the ID moved onto
     the note.
   - Live claims grew from 49 to 93, mostly "Priority", "Trace" and "Status" lines.

## Fixes made from run 1

- The live-claims prompt now says the listed requirements are current decisions that win over the
  project description, and that an ID opens only the bullet stating that requirement.
- A bug fix's regression criterion goes to the Tasks phase when it has a document and to the first
  phase with one otherwise. Before, an early project with only a PRD could never draft a bug fix,
  because the criterion was always sent to Tasks and dropped.

## Runs 2 and 3: after the fixes, on a fresh project

1. The PRD generated 2 live claims; this generation wrote few bullets the extractor recognises.
2. The same bug fix drafted two additions (no expiry requirement existed to reword): REQ-0003,
   "valid for seven days", and REQ-0004, the regression criterion. Regenerating kept both IDs on
   the same statements, lightly reworded, with "seven days" intact against a description that
   says one day, and no conflict note.
3. A feature change, "invitations last fourteen days", reworded REQ-0003 and REQ-0012. Regenerating
   kept both IDs with the fourteen-day wording: none retired, no line left saying seven days, no
   conflict note.
4. The export zip held `changes/CHG-0001-invitations-expire-before-people-can-accept-them.md` and
   `changes/CHG-0002-invitations-last-fourteen-days.md`, each edit under its ID with the wording
   before and after.

## Open

- **Claim noise.** `extractClaimCandidates` turns metadata bullets ("Priority", "Trace", "Status",
  "Verification") into claims, and each regeneration adds more: 49 to 93 in run 1, 32 to 56 in run
  3. A change can then target noise, as run 1 did with REQ-0023. The extraction heuristic predates
  this phase; tightening it is its own change.
- **Extraction yield varies.** The same description produced 48 claims in run 1 and 2 in run 2,
  depending on how the model formatted the PRD.
- **The pages were not seen in a signed-in browser.**
