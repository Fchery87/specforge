# Guided workflow implementation plan

**Status:** Not started

**Spec:** [Guided three-stage workflow](../specs/2026-09-25-guided-workflow.md)

This plan changes what a SpecForge user sees. Three stages replace eight phases. Every page gets a next action. Project Rules and Export are always available. The export ships `AGENTS.md` plus a one-line `CLAUDE.md`. The eight phase IDs stay in storage and generation. Nine pull requests deliver it, in the order of the task table.

## How to read this

One row in the task table is one pull request. One box is one unit of work, and each box names the evidence that checks it. Check a box only when its evidence exists, such as a file, a log line, a screenshot, a test run, or a SHA. Update the task table row in the commit that finishes the task, and record the SHA only after `git cat-file -t <sha>` prints `commit`.

Branch each pull request from `main` as `feature/<slug>`, or from its parent branch when the parent is not merged yet. Use Conventional Commits. The operator reviews and merges every pull request, because `AGENTS.md` requires one approval. Pull requests 5, 6, 7, and 9 change an interaction and are review-gated.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. The live checks run the authenticated Playwright suite from pull request 1 against a Convex development deployment. The perf check runs only where a user waits on the changed code. Each other pull request states why it has no perf check.

## Tasks

| # | Task | State | SHA | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Add an authenticated Playwright suite | Not started | none | `npm run test:e2e` passes the signed-in smoke test |
| 2 | Delete duplicate phase definitions | Not started | none | Gates pass and `rg` finds one phase list |
| 3 | Add the workflow model in `lib/workflow.ts` | Not started | none | `lib/workflow.test.ts` passes |
| 4 | Check model credentials before intake | Not started | none | Unit tests and the no-credentials e2e case pass |
| 5 | Replace phase navigation with the stage stepper | Not started | none | E2e stage cases pass and the operator approves screenshots |
| 6 | Rebuild the project page and dashboard cards around stages | Not started | none | E2e project-page cases pass and the operator approves screenshots |
| 7 | Rename modes and move defaults to `MODE_POLICIES` | Not started | none | Unit tests and the e2e creation cases pass |
| 8 | Export `AGENTS.md` as the only rules file | Not started | none | ZIP test and a Claude Code `/context` check |
| 9 | Add the Lite combined question round and Draft rules | Not started | none | E2e Lite flow passes and the operator approves the video |

States are `Not started`, `In progress`, `Done, unverified`, and `Done`. `Done` requires a real SHA and a verification that ran. `Done, unverified` names what is missing.

## Operator prerequisites

- [ ] Create a Clerk test user in the development instance. Put `E2E_CLERK_USER_USERNAME` and `E2E_CLERK_USER_PASSWORD` in `.env.local`. Never commit them.
- [ ] Confirm a Convex development deployment that `npm run convex` can reach, with `CLERK_JWT_ISSUER_DOMAIN` and `CONVEX_ENCRYPTION_KEY` set.
- [ ] Provide one model API key for the manual generation checks in pull requests 5, 6, 8, and 9.

## Add an authenticated Playwright suite (PR 1)

**Depends on.** None.

**Files.**

- [ ] Edit `package.json` to add `@clerk/testing` as a dev dependency.
- [ ] Create `e2e/global.setup.ts`.
- [ ] Edit `playwright.config.ts` to add a `setup` project and a `signed-in` project that depends on it.
- [ ] Create `e2e/signed-in.spec.ts`.

**Build.**

- [ ] In `e2e/global.setup.ts`, call `clerkSetup()`, sign in the test user with `clerk.signIn`, and save the storage state to `e2e/.auth/user.json`.
- [ ] Add `e2e/.auth/` to `.gitignore`.
- [ ] In `e2e/signed-in.spec.ts`, open `/dashboard` and assert the heading is visible.

**You see.**

- [ ] `npm run test:e2e` lists the setup project, the four existing smoke tests, and the signed-in test as passed.

**Verify, unit.**

- [ ] None. The pull request adds only test infrastructure.

**Verify, live.**

- [ ] Run `npm run test:e2e` twice in a row. Both runs pass, and the second run reuses the saved storage state.
- [ ] Run it once with `E2E_CLERK_USER_PASSWORD` unset. The setup project fails with a message that names the missing variable.

**Verify, perf.**

- [ ] None. No user waits on this code.

**Review gate.** None. PR 1 is not review-gated.

**Merge.**

- [ ] `npm run typecheck`, `npm run lint`, and `npm run test -- --run --reporter=dot --testTimeout=20000` exit zero.
- [ ] The operator approves and squash-merges.

## Delete duplicate phase definitions (PR 2)

**Depends on.** None.

**Files.**

- [ ] Create `lib/workflow.ts` with `PhaseId` and `PHASE_ORDER` only.
- [ ] Edit `lib/phase-config.ts` to type `id` as `PhaseId` and to order entries by `PHASE_ORDER`.
- [ ] Edit `app/project/[id]/page.tsx` to delete the local `PHASES` array and read `PROJECT_PHASES`.
- [ ] Edit `convex/projects.ts` to delete `DEFAULT_PHASES` and import `PHASE_ORDER`.
- [ ] Delete `lib/specification/phase-registry.ts` and `lib/specification/__tests__/phase-registry.test.ts`.

**Build.**

- [ ] Make `PHASE_ORDER` the only literal list of the eight phase IDs in `app/`, `components/`, `lib/`, and `convex/`, outside tests and `convex/schema.ts`.

**You see.**

- [ ] The project page shows the same eight cards as before, with the descriptions from `lib/phase-config.ts`.

**Verify, unit.**

- [ ] Run `npm run test -- --run lib components convex`. All tests pass.
- [ ] Run `rg -n "'domainModel',\s*$" app components lib convex --glob '!**/*.test.*' --glob '!convex/schema.ts'`. Only `lib/workflow.ts` matches.

**Verify, live.**

- [ ] Run `npm run test:e2e`. All tests pass.
- [ ] Create a Full project in the browser. The project page shows eight phases in the order of `PHASE_ORDER`. Save `pr2-project.png`.

**Verify, perf.**

- [ ] None. The change moves constants and adds no work at runtime.

**Review gate.** None. PR 2 is not review-gated.

**Merge.**

- [ ] The three gate commands exit zero.
- [ ] The operator approves and squash-merges.

## Add the workflow model in lib/workflow.ts (PR 3)

**Depends on.** PR 2.

**Files.**

- [ ] Edit `lib/workflow.ts`.
- [ ] Create `lib/workflow.test.ts`.

**Build.**

- [ ] Add `StageId`, `WorkflowStage`, `WORKFLOW_STAGES`, `RULES_PHASE`, and `EXPORT_PHASE` with the grouping in the spec.
- [ ] Add `ProjectMode`, `ModePolicy`, and `MODE_POLICIES` with the labels, review stops, and default skipped phases in the spec.
- [ ] Add `stageStatus` and `nextAction` as pure functions over `PhaseStatusMap` and the skipped list.
- [ ] Type `NextAction` as a discriminated union with the kinds `answer`, `generate`, `review`, `continue`, and `export`. Each kind carries the phase or stage it names.

**You see.**

- [ ] Nothing in the UI changes. PR 5 is the first caller.

**Verify, unit.**

- [ ] `lib/workflow.test.ts` asserts the literal `phaseIds` of each stage.
- [ ] It asserts that no `MODE_POLICIES` entry lists `constitution` or `stories` in `skippedPhases`.
- [ ] It asserts that `stageStatus` returns `ready` for Design when `specs` is ready and `domainModel` and `artifacts` are skipped.
- [ ] It asserts that `stageStatus` returns `error` when any enabled phase in the stage has an error.
- [ ] It asserts that `nextAction` for a new Full project returns `{ kind: 'answer', phaseId: 'brief' }`.
- [ ] It asserts that `nextAction` for a Full project with Requirements ready and Design not started returns `{ kind: 'continue', stageId: 'design' }`.
- [ ] It asserts that `nextAction` for a Lite project with no answers returns `{ kind: 'answer', phaseId: 'brief' }`, and that no Lite state returns `review`.
- [ ] It asserts that `nextAction` returns `{ kind: 'export' }` when every enabled phase is ready.
- [ ] Run `npm run test -- --run lib/workflow.test.ts`. All cases pass.

**Verify, live.**

- [ ] None. No page reads the model yet. PR 5 carries the live check.

**Verify, perf.**

- [ ] None. The functions run over at most eight entries.

**Review gate.** None. PR 3 is not review-gated.

**Merge.**

- [ ] The three gate commands exit zero.
- [ ] The operator approves and squash-merges.

## Check model credentials before intake (PR 4)

**Depends on.** None.

**Files.**

- [ ] Edit `convex/actions/generatePhase.ts`.
- [ ] Create or edit the module that owns the credential lookup, so that `resolveCredentials` and the new query share one function.
- [ ] Create `getGenerationReadiness` as a query in `convex/userConfigs.ts`.
- [ ] Create `components/generation-readiness-banner.tsx` and its test.
- [ ] Edit `app/(auth)/dashboard/new/page.tsx` and `app/project/[id]/phase/[phaseId]/page.tsx` to render the banner.

**Build.**

- [ ] Extract the rule that decides whether a user has a usable credential into one function. The rule reads the user config, the system credentials, and the enabled models, and it does not decrypt keys.
- [ ] Make `resolveCredentials` and `getGenerationReadiness` both call that function.
- [ ] Make `generateSectionContent` throw `No LLM credentials configured` when it gets no client, in both places that return placeholder markdown today.
- [ ] Make the banner say "Connect a model to generate specs", with a link to `/settings`.

**You see.**

- [ ] An account with no credentials, on a deployment with no system credentials, sees the banner on `/dashboard/new` above the brief field.

**Verify, unit.**

- [ ] Add a test for the shared function with three cases. A user key gives ready. A system key for an enabled model gives ready. No usable key gives `no-credentials`.
- [ ] Add a test that `generateSectionContent` rejects with `No LLM credentials configured` when `llmClient` is null.
- [ ] Add `components/__tests__/generation-readiness-banner.test.tsx`. It renders the link to `/settings` when `ready` is false and renders nothing when `ready` is true.

**Verify, live.**

- [ ] Add an e2e case that opens `/dashboard/new` as the test user with no user key. If the deployment has no system credentials, assert that the banner is visible. Otherwise skip the case with a message that names the system credential. Save `pr4-banner.png`.
- [ ] Add a user key in settings and reload. The banner is gone. Save `pr4-ready.png`.

**Verify, perf.**

- [ ] None. The query reads three small records once per page load.

**Review gate.** None. PR 4 is not review-gated. The banner is new copy, so include `pr4-banner.png` in the pull request body.

**Merge.**

- [ ] The three gate commands exit zero.
- [ ] The operator approves and squash-merges.

## Replace phase navigation with the stage stepper (PR 5)

**Depends on.** PR 1 and PR 3.

**Files.**

- [ ] Create `components/stage-stepper.tsx` and `components/__tests__/stage-stepper.test.tsx`.
- [ ] Create `components/stage-tabs.tsx` for the sub-tab row.
- [ ] Create `components/next-action-button.tsx`.
- [ ] Edit `app/project/[id]/phase/[phaseId]/page.tsx`.
- [ ] Delete `components/phase-switcher.tsx`, `components/__tests__/phase-switcher.test.tsx`, and `components/phase-status.tsx`.

**Build.**

- [ ] Render three steps from `WORKFLOW_STAGES` in `StageStepper`, each with its `stageStatus`. Each step links to the first enabled phase in the stage that is not ready, or to the first enabled phase.
- [ ] Render the enabled phases of the current stage as tabs in `StageTabs`. Show skipped phases under an "Add a section" menu that calls `toggleSkipPhase`.
- [ ] Render the primary button from `nextAction` in `NextActionButton`. The labels are "Answer questions", "Generate", "Continue to Design", "Continue to Tasks", and "Export".
- [ ] Remove `PhaseSwitcher` and `PhaseStatusIndicator` from the phase page. Keep the breadcrumbs.
- [ ] Show "Project Rules" as the page heading for `constitution`, with no stepper step highlighted.

**You see.**

- [ ] `/project/<id>/phase/prd` shows three steps with Requirements active, tabs for Brief and PRD, and one primary button.

**Verify, unit.**

- [ ] `stage-stepper.test.tsx` asserts exactly three links with the labels "Requirements", "Design", and "Tasks", and no element with the text "Skipped".
- [ ] A `next-action-button` test asserts the label and the `href` for each `NextAction` kind.
- [ ] Run `npm run test -- --run components`. All tests pass.

**Verify, live.**

- [ ] Regression check against `main`. Open `/project/<id>/phase/prd` for the same Full project on `main` and on the branch. `main` shows eight phase links. The branch shows three. Save `pr5-trunk.png` and `pr5-head.png`.
- [ ] E2e case. Create a Lite project and open its first phase. The stepper has three steps and no text "Skipped". Save `pr5-lite.png`.
- [ ] E2e case. On a Full project, open Design. The tabs are Domain Model, Architecture, and Schemas.
- [ ] E2e case. On a Lite project, open Design. The only tab is Architecture. "Add a section" lists Domain Model and Schemas.
- [ ] E2e case. Choose Domain Model under "Add a section". The tab appears without a page reload.
- [ ] Manual case with a model key. Generate Brief and PRD on a Full project. The primary button reads "Continue to Design" and opens the Design stage. Save `pr5-continue.png`.
- [ ] E2e case. Open `/project/<id>/phase/constitution`. The heading is "Project Rules".
- [ ] E2e case at a 390px viewport. The stepper fits without horizontal page scroll. Save `pr5-mobile.png`.

**Verify, perf.**

- [ ] Metric. Time from navigation to a visible stepper on `/project/<id>/phase/prd`.
- [ ] Probe. A Playwright script loads the page 10 times on `main` and 10 times on the branch, interleaved, and records `performance.now()` when the stepper is visible.
- [ ] Baseline. Record the median on `main` first.
- [ ] Rule. The pull request fails if the branch median is more than 10 percent or 100 ms slower than `main`, whichever is larger.

**Review gate.** The operator reviews before merge.

- [ ] Copy `pr5-trunk.png`, `pr5-head.png`, `pr5-lite.png`, `pr5-continue.png`, and `pr5-mobile.png` into the pull request body.
- [ ] Record a 30 to 60 second video that moves from Requirements to Design with the Continue button, and link it from the pull request.
- [ ] Wait for the operator's approval.

**Merge.**

- [ ] The three gate commands and `npm run test:e2e` exit zero.
- [ ] The operator approves and squash-merges.

## Rebuild the project page and dashboard cards around stages (PR 6)

**Depends on.** PR 5.

**Files.**

- [ ] Create `components/stage-card.tsx` and its test.
- [ ] Create `components/project-rules-card.tsx` and its test.
- [ ] Edit `app/project/[id]/page.tsx`.
- [ ] Edit `components/dashboard/project-card.tsx` and `components/__tests__/project-card.test.tsx`.
- [ ] Delete `components/phase-stepper.tsx`, `components/__tests__/phase-stepper.test.tsx`, and `components/project-phase-card.tsx` with its test, if no caller remains.

**Build.**

- [ ] Replace the eight phase cards with three `StageCard`s. Each shows the stage summary, the `stageStatus`, and the `NextActionButton` for that stage.
- [ ] Add `ProjectRulesCard`. It shows a count of `proposed` and `unresolved` entries in the constitution `decisionRegister`, parsed with `ConstitutionSchema`. If parsing fails, show no count.
- [ ] Add an Export button to the project header that opens `ExportOptionsPanel` in a dialog at every stage.
- [ ] Rename the "Quick Spec history" button to "Saved quick specs".
- [ ] Link each dashboard project card to the page from `nextAction`, labelled "Resume at <stage>" or "Export".

**You see.**

- [ ] A project page with three stage cards, one Project Rules card, and an Export button in the header.

**Verify, unit.**

- [ ] `stage-card.test.tsx` asserts the status text and the button label for a ready stage and for a stage that is not started.
- [ ] `project-rules-card.test.tsx` asserts "2 proposed rules need review" for a constitution with two `proposed` entries. It asserts no count for invalid JSON.
- [ ] `project-card.test.tsx` asserts "Resume at Design" and the Design `href` for a project whose Requirements stage is ready.

**Verify, live.**

- [ ] Regression check against `main`. The same Full project shows eight cards on `main` and three stage cards plus Project Rules on the branch. Save `pr6-trunk.png` and `pr6-head.png`.
- [ ] E2e case. On a new Lite project, the page shows no card for Domain Model or Schemas.
- [ ] E2e case. Open Export from the header on a project with no generated phases. The dialog opens and lists the export options.
- [ ] Manual case with a model key. After Requirements is ready, the dashboard card reads "Resume at Design" and opens Design. Save `pr6-dashboard.png`.
- [ ] E2e case. The "Saved quick specs" button opens `/project/<id>/quick`.
- [ ] E2e case at a 390px viewport. The cards stack into one column with no horizontal page scroll. Save `pr6-mobile.png`.

**Verify, perf.**

- [ ] Metric. Time from navigation to three visible stage cards on `/project/<id>` on the branch, against eight visible phase cards on `main`.
- [ ] Probe. The same interleaved Playwright script as PR 5, pointed at `/project/<id>`.
- [ ] Baseline. Record the median on `main` first.
- [ ] Rule. The pull request fails if the branch median is more than 10 percent or 100 ms slower than `main`, whichever is larger.

**Review gate.** The operator reviews before merge.

- [ ] Copy `pr6-trunk.png`, `pr6-head.png`, `pr6-dashboard.png`, and `pr6-mobile.png` into the pull request body.
- [ ] Record a 30 to 60 second video that opens a project from the dashboard, opens Project Rules, and opens Export.
- [ ] Wait for the operator's approval.

**Merge.**

- [ ] The three gate commands and `npm run test:e2e` exit zero.
- [ ] The operator approves and squash-merges.

## Rename modes and move defaults to MODE_POLICIES (PR 7)

**Depends on.** PR 3.

**Files.**

- [ ] Edit `convex/projects.ts`.
- [ ] Edit `app/(auth)/dashboard/new/page.tsx`.
- [ ] Edit `app/project/[id]/page.tsx` and `app/project/[id]/phase/[phaseId]/page.tsx` where they print mode labels.
- [ ] Add a test for `createProject` defaults beside the existing `convex/` tests.

**Build.**

- [ ] Replace the mode ternary in `createProject` with `MODE_POLICIES[args.mode].skippedPhases`. An explicit `args.skippedPhases` still wins.
- [ ] Delete the local `PROJECT_MODES` array in the new-project page. Read labels and flow summaries from `MODE_POLICIES`. Keep the icons in the page.
- [ ] Build each flow summary from `WORKFLOW_STAGES`, such as "Requirements, Design, Tasks. No review stops.", so the text cannot disagree with the policy.
- [ ] Replace every inline mode-label ternary with `MODE_POLICIES[mode].label`.

**You see.**

- [ ] The new-project page shows the modes Lite, Full, and Backend. The Backend summary matches what runs.

**Verify, unit.**

- [ ] The `createProject` test asserts that a new `quick` project stores `['domainModel', 'artifacts']`, a `full` project stores no skipped phases, and a `backend` project stores `['brief']`.
- [ ] Run `rg -n "Quick Feature Spec|Full System Blueprint|API & Backend Service" app components`. It prints nothing.

**Verify, live.**

- [ ] E2e case. Create one project in each mode. Each project page shows the stages that `MODE_POLICIES` enables. Save `pr7-new.png`.
- [ ] E2e case. Open a project created on `main` in `quick` mode. It keeps its stored skipped phases, and the page renders without errors.

**Verify, perf.**

- [ ] None. The change replaces constants and labels.

**Review gate.** The operator reviews before merge, because the mode names are user-facing copy.

- [ ] Copy `pr7-new.png` into the pull request body.
- [ ] Wait for the operator's approval.

**Merge.**

- [ ] The three gate commands and `npm run test:e2e` exit zero.
- [ ] The operator approves and squash-merges.

## Export AGENTS.md as the only rules file (PR 8)

**Depends on.** None. PR 6 adds the header button that opens the same dialog.

**Files.**

- [ ] Edit `lib/export/agents-formatter.ts` and its test.
- [ ] Edit `convex/actions/generateProjectZip.ts`.
- [ ] Edit `components/export-options.tsx`.
- [ ] Delete `lib/export/clipboard-formats.ts` and its tests if nothing else imports them.

**Build.**

- [ ] Group the constitution `decisionRegister` in `generateAgentsMd` under "Rules" for `confirmed`, "Observed in the repository" for `observed`, "Proposed, not confirmed" for `proposed`, and "Open questions" for `unresolved` plus `openQuestions`.
- [ ] Add a `CLAUDE.md` entry to the ZIP whose whole content is `@AGENTS.md` followed by a newline.
- [ ] Remove the "Copy for Claude Code" and "Copy for Cursor" options and their `format` values.
- [ ] Offer "Generate handoff notes" in the export dialog when the `handoff` artifact is missing. Do not block the other options.

**You see.**

- [ ] The export dialog lists Project ZIP, Agent Skill (SKILL.md), Agent Guide (AGENTS.md), and Markdown Bundle.

**Verify, unit.**

- [ ] The formatter test builds `AGENTS.md` from a constitution with one decision of each status. It asserts each decision appears under its literal heading, and that the proposed decision does not appear under "Rules".
- [ ] A test for the ZIP entry list asserts a `CLAUDE.md` with content `'@AGENTS.md\n'` and no path that starts with `.cursor`.

**Verify, live.**

- [ ] Manual case with a model key. Download the ZIP of a project with a generated constitution. `unzip -l` lists `AGENTS.md` and `CLAUDE.md`, and `unzip -p <zip> CLAUDE.md` prints `@AGENTS.md`. Save the terminal output as `pr8-zip.txt`.
- [ ] Extract the ZIP, open Claude Code in that folder, and run `/context`. `CLAUDE.md` appears under memory files with the `AGENTS.md` content. Save `pr8-context.png`.
- [ ] Open the same folder in Cursor and ask the agent which project rules apply. Its answer cites rules from `AGENTS.md`. Save `pr8-cursor.png`.
- [ ] E2e case. Open Export on a project with no `handoff` artifact. "Generate handoff notes" is visible, and Project ZIP is enabled.

**Verify, perf.**

- [ ] None. The ZIP gains one entry of 11 bytes.

**Review gate.** None. PR 8 changes export content, not an interaction. Include `pr8-zip.txt` and `pr8-context.png` in the pull request body.

**Merge.**

- [ ] The three gate commands exit zero.
- [ ] The operator approves and squash-merges.

## Add the Lite combined question round and Draft rules (PR 9)

**Depends on.** PR 6 and PR 7.

**Files.**

- [ ] Create `app/project/[id]/questions/page.tsx`.
- [ ] Create `components/combined-questions.tsx` and its test.
- [ ] Edit `components/project-rules-card.tsx`.
- [ ] Edit `app/(auth)/dashboard/new/page.tsx` to route new Lite projects to the questions page.

**Build.**

- [ ] List the required questions of every enabled phase in `CombinedQuestions`, grouped by stage. Call `generateAllQuestionAnswers` to fill suggestions. Label each suggestion as a suggestion until the user edits or accepts it.
- [ ] Save the answers, then call `generateAllPhases`, from one "Generate everything" button. Then open the project page, where the stage cards show progress.
- [ ] Add "Draft rules" to `ProjectRulesCard` for Full and Backend projects with no constitution. It fills the constitution questions with `generateAllQuestionAnswers` and generates the `constitution` phase.

**You see.**

- [ ] A new Lite project opens one questions page and reaches the project page with every stage generating after one click.

**Verify, unit.**

- [ ] `combined-questions.test.tsx` asserts that questions from Brief, PRD, and Architecture render under their stage headings, and that "Generate everything" stays disabled while a required answer is empty.
- [ ] It asserts that a suggested answer shows the label "Suggestion" until the user edits it.

**Verify, live.**

- [ ] Regression check against `main`. On `main`, a new Quick Feature Spec project opens the Brief phase. On the branch, a new Lite project opens the combined questions page. Save `pr9-trunk.png` and `pr9-head.png`.
- [ ] Manual case with a model key. Fill the suggestions, click "Generate everything", and wait. Every enabled phase reaches `ready`, and the dashboard card reads "Export". Save `pr9-done.png`.
- [ ] Manual case with a model key. On a Full project, click "Draft rules". The constitution generates, and the card shows the count of proposed rules. Save `pr9-rules.png`.
- [ ] E2e case. On the questions page with one required answer empty, "Generate everything" is disabled.

**Verify, perf.**

- [ ] Metric. Wall time from "Generate everything" to every enabled phase `ready` on a Lite project, against running the same phases one at a time with the Continue button on `main`.
- [ ] Probe. Run both flows with the same brief, the same answers, and the same model. Record the timestamps from the phase status records.
- [ ] Baseline. Record the `main` time first.
- [ ] Rule. The pull request fails if the Lite flow takes longer than the manual flow on `main`. Report user clicks for both flows next to the times.

**Review gate.** The operator reviews before merge.

- [ ] Copy `pr9-trunk.png`, `pr9-head.png`, `pr9-done.png`, and `pr9-rules.png` into the pull request body.
- [ ] Record a 30 to 60 second video of a Lite project from creation to Export.
- [ ] Wait for the operator's approval.

**Merge.**

- [ ] The three gate commands and `npm run test:e2e` exit zero.
- [ ] The operator approves and squash-merges.

## Close the plan

- [ ] Every row in the task table reads `Done` with a SHA that passes `git cat-file -t`.
- [ ] Every deleted path in the spec's deletion inventory is gone, checked with `ls` on each path.
- [ ] Run the `keel-close` skill. It verifies the SHAs, updates `docs/roadmap.md`, and deletes this file.

## Notes

- The order puts subtraction first. PR 2 deletes duplicate phase lists before PR 3 adds the model, so the model has one source to replace.
- PR 1, PR 2, PR 4, and PR 8 have no dependencies and can run at the same time.
- The authenticated suite cannot call a model without a key in CI. Cases that need generated content are manual cases with saved screenshots. Every other case is automated.
- Alternatives rejected and risks live in the spec. This file holds only task state.
