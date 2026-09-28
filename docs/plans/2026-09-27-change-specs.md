# Change and bug-fix specs

**Status:** In progress

**Spec:** [Change and bug-fix specs](../specs/2026-09-27-change-specs.md)

## Tasks

Identity comes first, because every later task relies on a claim keeping its ID when its wording
changes. Each task lands as its own commit, and the gates in `.keel/config.md` exit zero at each.

| # | Task | State | SHA | Verified by |
| --- | --- | --- | --- | --- |
| 1 | `reconcileArtifactClaims` matches an item's leading `**REQ-nnnn**` against live claims before falling back to text, and strips the `[status; review]:` prefix from the stored text | Done | `9439b4a` | `convex/__tests__/evidence.test.ts`: a reworded item carrying `**REQ-0012**` keeps `REQ-0012` with the new text; an unknown ID falls back to text matching |
| 2 | Generation prompts list the phase's live claims with their IDs and tell the model to keep an ID on a requirement it rewords | Done | `9439b4a` | Prompt test asserts the ID list and the instruction appear in the assembled prompt for PRD and Architecture; `lib/llm/prompts/__tests__/claim-ids.test.ts`; schema accepted by `npx convex dev --once` on dev |
| 3 | Schema: `changes`, `changeOps` (op as a discriminated union), `claimRevisions`, `projects.nextChangeNumber` | Done | `69485ee` | `npm run typecheck`; `npx convex dev --once` pushes to the dev deployment |
| 4 | Change mutations: create (refused when the project has no live requirements), replace ops on a draft, abandon; owner checks on each | Done | `69485ee` | `convex/__tests__/changes.test.ts`: create, refusal, foreign-owner refusal, ops replaced only while draft |
| 5 | `applyChange`: check every `baseText`, then add, modify with a `claimRevisions` row, remove, and mark touched phases stale with `staleReason: "CHG-nnnn applied"`, in one mutation | Done | `e99fad7` | `changes.test.ts`: ID issued on add; ID, evidence links and revision kept on modify; `retiredAt` on remove; a stale `baseText` applies nothing and names the op |
| 6 | Draft parser in `lib/changes/`: parse the model's ops, drop ops naming unknown or retired claims with a note, reject a bug fix with no added acceptance criterion | Done | `aaa726c` | `lib/changes/__tests__/parse-draft.test.ts` with literal inputs and expected ops |
| 7 | `draftChange` action: live claims with IDs, the description, bug fields and repository evidence in; parsed ops out, saved to the draft | Done | `aaa726c` | `lib/changes/__tests__/run-draft.test.ts` drives the draft with a stubbed model: one pass, a retry for a missing regression criterion, and the note when the retry still has none; `getDraftContextHandler` tests pin the inputs. A live model call waits for task 13 |
| 8 | Project page "Changes" section and the "New change" form (feature or bug; bug asks observed, expected, reproduction) | Done | `d288e1b` | Component tests; `/design` fixture captured at 1440 and 390 in both themes |
| 9 | Change page `/project/[id]/change/[changeId]`: ops as a diff, edit, delete and add ops, apply, and the conflict refresh | Done | `d288e1b` | Component tests for each op's rendering and the conflict state; `/design` captures |
| 10 | Phase page line when a change was applied after the document was generated, with the regenerate control | Done | `d288e1b` | `stale-document-notice.test.tsx`; the phase page shows it when `isStale` is set and the phase has a document |
| 11 | Export writes each applied change to `changes/CHG-nnnn-<slug>.md` | Done | `2dfaee4` | `generateProjectZip` test finds the file and its op lines; `render-markdown.test.ts` pins the whole file; `listAppliedChanges` test resolves each edit's ID |
| 12 | Quick spec: replace "Save to an existing project" with "Start a change from this"; migrate saved quick specs into draft changes; `createProjectFromQuickSpec` puts the spec in the project description; delete `saveQuickSpec`, `saveQuickSpecHandler`, the `phaseId: 'quick'` slot, `/project/[id]/quick` and the "Saved quick specs" link | Done, unverified: SHA recorded after the squash merge | — | Quick spec page test; `quick-spec-save.test.ts` rewritten for the evidence source; migration test on the fake context; row count of `quickSpec` artifacts on dev is zero after the migration runs |
| 13 | Walkthrough on the dev deployment: draft and apply a bug fix, see the PRD marked out of date, regenerate, and see the modified requirement keep its ID | Not started | — | Screenshots and the claim IDs before and after, in `design/screens/changes/` |

States: `Not started`, `In progress`, `Done, unverified`, `Done`.

`Done` requires a real SHA that passes `git cat-file -t`, and a verification that
actually ran. `Done, unverified` is honest and must say what is missing.

## Notes

- Tasks 1 and 2 ship together if task 1 alone would let a regeneration drop IDs the prompt never
  asked the model to keep. Task 1's fallback keeps today's behaviour for ID-less items, so it can
  land alone.
- Task 12 runs last among the code tasks because it deletes a path that saved quick specs use
  today, and the migration needs `changes` to exist.
- Pull requests are squash-merged, so a task's SHA is the squash commit on `main`, recorded in the
  next pull request. Tasks 1 and 2 landed together in #44.
- Tasks 3 and 4 also cascade the new tables in `deleteProjectHandler`, pinned by
  `cascade-delete.test.ts`, and add the `listChanges` and `getChange` queries the pages in tasks 8
  and 9 read.
- Task 5 also refuses a bug fix with no added acceptance criterion, which the spec requires of every
  bug fix; task 6 keeps the same rule in the draft parser so the reader sees it before applying.
- Task 6's parser flags a bug fix with no regression criterion rather than rejecting the whole draft.
  Task 7 then drafts once more with a reminder, and if the retry still has none it keeps the edits and
  tells the reader to add the criterion, because `applyChange` refuses a bug fix without one.
- Task 7 moved the credential and client setup out of `generateQuickSpec` into
  `convex/actions/llmSession.ts`, which the draft action shares.
- Tasks 8 and 9 were captured from `/design` fixtures (`app/design/change-previews.tsx`) into
  `design/screens/changes/`, because the pages read Convex behind sign-in. The live pages are part of
  task 13's walkthrough.
- Task 11 found that the project zip was built once and reused forever, so it never held later
  phases or changes. Downloads now rebuild it.
- Task 12's migration ran on dev with `npx convex run changes:migrateSavedQuickSpecs` and moved 0
  quick specs (17 artifacts, none of type `quickSpec`). With production empty, the `quickSpec` type
  and the migration were then removed; its test lived in the commit that added it.
- Prod has no data, so the task 12 migration only matters on dev and for any user data created
  before it ships.
