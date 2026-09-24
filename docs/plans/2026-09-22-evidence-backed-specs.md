# Evidence-backed specifications implementation plan

**Status:** Live Convex walkthrough pending; local implementation gates verified  
**Date:** 2026-09-22  
**Spec:** [Evidence-backed specifications](../specs/2026-09-22-evidence-backed-specs.md)

## Delivery order

Each step ends with a check a reviewer can run or observe. Complete the data and review loop before changing export or evaluation behavior. Keep the existing phase flow working throughout the sequence.

| Step | Work | Evidence of completion |
| --- | --- | --- |
| 0 | Record baseline and identify current source, artifact, ticket, export, and verification paths. | Done: [baseline note](../evaluations/2026-09-22-evidence-baseline.md). |
| 1 | Capture immutable evidence revisions. | Done: answer and commit-pinned file revisions, bounded redacted excerpts, owner checks, and source change impact tests. |
| 2 | Give claims stable IDs and validate their source links. | Done: generated candidates are proposed, markers are allowlisted, links are suggestions, and owners can confirm or reject. |
| 3 | Add claim review and change impact. | Done: source changes flag linked claims, tickets, phases, and prior verification runs; review events record owner actions. |
| 4 | Carry IDs into tickets, exports, and verification. | Done: acceptance criteria carry IDs on exact phrase matches; agent and ZIP exports include traceability; verification validates IDs and paths and stores input revisions. |
| 5 | Save Quick Specs to projects. | Done: Quick Specs save to a `quickSpec` artifact with version history, without creating a phase row. |
| 6 | Evaluate the workflow and finish rollout. | Local fixed examples and repo gates recorded in [evaluation note](../evaluations/2026-09-22-evidence-workflow-evaluation.md); live Convex walkthrough awaits a reachable configured deployment. |

## Step 0: Establish the baseline

- Inspect the current paths in `convex/schema.ts`, `convex/internal.ts`, `convex/artifacts.ts`, `convex/actions/verifyImplementation.ts`, `lib/verification/spec-checker.ts`, `components/verification-panel.tsx`, `components/export-options.tsx`, and `convex/actions/generateQuickSpec.ts`.
- Record how many claims in a small, fixed sample have a verifiable source today. Use at least one project with a repository scan and one without one. Do not put private answer text or repository content in the baseline note.
- Record the current time and user actions needed to find the answer or file behind a requirement. Use this as the comparison for the new flow.
- Confirm that the worktree's existing OAuth, template, and constitution changes are the intended base before opening implementation branches. Do not mix those edits into the first feature commit by accident.

**Check:** The baseline note lists sample selection, method, counts, and the current code paths. A second reader can repeat the measurement.

## Step 1: Capture evidence revisions

- Add project-scoped evidence source records to `convex/schema.ts`. Use a discriminated source kind for answer, repository file, and user note. Store a stable source ID, revision ID, content hash, captured time, and bounded display excerpt. Add indexes by project and source ID.
- On an answer save, capture a new revision only when its content changes. Keep old revisions readable for historical artifacts.
- Extend repository scans in `convex/actions/scanCodebase.ts` and `projectCodebase` to retain the scanned commit SHA. Capture file references by commit and path. If a scan cannot resolve a commit, mark its files unversioned and unavailable for confirmed repository evidence.
- Add authenticated queries and mutations that verify project ownership at every boundary. Bound note and excerpt length, and avoid storing tokens or secret-bearing repository excerpts in links.

**Check:** Unit and Convex tests cover unchanged answers, changed answers, changed commits, missing commits, and cross-project reads. A manual scan shows a commit SHA and stable file locator.

## Step 2: Add claims and source links

- Add project-scoped claim and evidence link records. Keep internal claim IDs stable across text edits and ordering. Store an artifact version reference and separate decision status from review status.
- Implement claim reconciliation for regeneration. Preserve an ID only for an unchanged obligation or a user-confirmed wording edit. Retire an earlier ID and create a new one when the obligation changes; flag uncertain matches for review.
- Extract claims from constitution decisions, PRD and technical requirements, and story acceptance criteria. Have generation request links only from supplied source IDs. Validate the generated shape in a pure parser before any database write.
- Save valid links in a transaction with the artifact version. Store unsupported or missing links as `needs_review`. Do not promote `proposed` or `unresolved` claims to `confirmed` because an LLM returned a label.
- Render claim IDs, status, and evidence in `components/artifact-preview.tsx` or the artifact editor. Opening a link shows the captured revision and locator.

**Check:** Parser tests reject invented IDs, malformed locators, duplicate IDs, and unsupported status transitions. A generated artifact shows at least one valid answer link, one valid repository link when a versioned scan exists, and one unsupported claim for review.

## Step 3: Connect source changes to review

- Compare new source revisions with the revisions linked to current claims. Mark affected claims `needs_review` and retain the old source alongside the new one for comparison.
- Use `lib/specification/dependency-graph.ts` to derive affected artifacts and phases. Make the existing phase `isStale` field a summary of claim impact rather than a second independent source of truth for these changes.
- Show affected claims, tickets, and verification results in the project view. Let the user confirm, revise, or leave each claim unresolved. Record who reviewed it and when.
- Regeneration must preserve accepted user constraints and create a new artifact version. It must not clear review flags until claims have valid current links or an explicit unresolved decision.

**Check:** A test changes one answer and proves that a linked claim becomes stale while an unrelated claim stays current. A browser walkthrough shows old and new text, a review action, and the resulting version history.

## Step 4: Carry the contract through implementation

- Link tickets in `convex/schema.ts` and `lib/ticket-parser.ts` to claim IDs. Preserve these IDs when ticket status or order changes.
- Add readable IDs and evidence references to the existing ZIP, agent guide, and skill exports. Clearly label proposed and unresolved claims. Legacy exports must still work.
- Extend `lib/verification/spec-checker.ts`, `convex/actions/verifyImplementation.ts`, and `verificationResults` so each finding can reference a validated requirement ID and changed file path. Save the artifact version, source revision set, and diff digest used for the run.
- Mark an earlier verification result outdated when its artifact version or linked source revisions change. Keep its result for history; do not silently reuse its pass status.

**Check:** Export tests assert stable IDs and statuses. Verification tests reject unknown and cross-project IDs. A manual pasted diff produces a finding linked to the same requirement ID visible in the artifact and export.

## Step 5: Reuse the short path

- Add an optional **Save to project** action to `app/(auth)/dashboard/quick/page.tsx`. Keep standalone Quick Spec generation available.
- Add `quickSpec` to the artifact type union in `convex/schema.ts`. Save it with phase ID `quick`, without inserting a `phases` row.
- Reuse artifact versioning and claim validation when saving. Let the user attach existing project evidence or a new note, then review unsupported claims.
- Avoid creating placeholder phases for a saved Quick Spec. Add a clear entry point from the project page to the saved result.

**Check:** Browser tests cover standalone generation, saving to an owned project, an unauthorized project ID, and reopening the saved version. The saved artifact appears in project history without new empty phases.

## Step 6: Evaluate and release

- Build a fixed evaluation set with a small greenfield brief, an existing repository, a conflicting answer and template, an answer revision, and a repository rescan. Keep fixtures free of private data.
- Measure valid evidence-link rate, unsupported claim rate, change-review time, and findings with requirement IDs against the Step 0 baseline. Record incorrect support claims separately; a plausible citation is still wrong if the source does not support the statement.
- Run `npm run typecheck`, `npm run lint`, `npm run test -- --run`, and the required Turbopack `npm run build`. Run a browser walkthrough with a real development Convex deployment for source capture, review, export, Quick Spec save, and pasted-diff verification.
- Update the README and handoff guide with the new evidence and review behavior. Record known limits, including the manual diff input and unverified external URLs.

**Check:** The evaluation note includes inputs, actual results, failed cases, and a release decision. The full gates pass at the same code revision as the walkthrough.

## Order and scope controls

- Do not start source-linked generation before source IDs and ownership checks exist.
- Do not claim an automated verification pass proves implementation correctness. Keep the model's assessment advisory.
- Do not add automatic GitHub pull request review, repository writes, web crawling, or collaboration roles in this plan.
- If a step requires a different data contract, revise the spec first and record why in the plan before changing downstream code.
