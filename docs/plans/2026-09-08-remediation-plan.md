# SpecForge remediation plan

Eight PRs bring the stack to September 2026 standards and fix one correctness bug. The bug restores user-supplied API keys in generation. The upgrades close the version gaps the audit measured. The PR ids run PR1 to PR8 in a linear stack. The operator lands each PR bottom-up as it turns merge-ready.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs the `autopilot-stack` shape from `~/.agents/skills/poteto-mode/playbooks/autopilot-stack.md`, adapted to this harness. Adaptations are listed in Appendix C. There is no subagent machinery in this environment, so one in-session agent owns every PR and the operator merges. There are no cloud VMs, so live lanes run locally against `npm run dev` plus `npm run convex` and drive the surface through the `agent-browser` skill. This repo has no `pstack/` directory, so skill files are read from the local skill store at `~/.agents/skills/`.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on her explicit go.
- [ ] On her go, arm a `/goal` with this exact text. "Run docs/plans/2026-09-08-remediation-plan.md, PR1 through PR8 in stack order, every PR gated by the verification rule, the operator merges each PR, done when PR8 is merge-ready and every box has evidence." This harness has no `/goal` command, so record the same text as the session goal in the working notes.
- [ ] Read these from the canonical store at every PR boundary and re-read them at every tick. This repo has no skill tree on trunk, so `git show origin/main:` returns nothing for skill files here and the local store under `~/.agents/skills/` is the canonical copy.
  - [ ] `~/.agents/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `~/.agents/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `~/.agents/skills/technical-writing/SKILL.md` and `~/.agents/skills/unslop/SKILL.md` before any doc PR
- [ ] Arm the 30-minute audit tick while any lane batch runs. In a local session this is a real terminal `/loop` on the operator's side, or the agent checks elapsed time between lane batches. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the plan and the stack playbook. Audit the stack against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then send the operator a status message, whether or not anything changed, with the queue table of PR, state, and head SHA, the verdicts since the last tick, what merged, what can land now, open gates, and blockers."

### Spawn owners

- [ ] One in-session agent owns every PR with the full lifecycle. Open, build, verify, merge-ready report.
- [ ] Follow this dependency graph. The stack is linear, so each PR branches on the previous PR's head.
  - [ ] PR2 is first. Everything else depends on its build gate.
  - [ ] PR1 and PR3 have no dependency on each other. In the stack, PR1 sits directly above PR2 and PR3 above PR1.
  - [ ] PR4 after PR3. PR5 after PR4. PR6 and PR7 after PR5, in that order. PR8 after PR7.
- [ ] Hold the file boundaries. PR1 touches only `convex/userConfigActions.ts`, `convex/internalActions.ts`, and `convex/__tests__/`. PR3 touches only `lib/llm/model-data.ts` and `lib/llm/__tests__/registry.test.ts`.
- [ ] Hold the review gate. PR4 and PR7 change an interaction. They wait for the operator's review in chat with screenshots and a video before merge.
- [ ] Before PR1, clean the trunk. The working tree has uncommitted changes to eight admin pages. Commit them on a side branch or stash them, so every PR diff measures only its own change.

### PR mechanics, for every PR

- [ ] Open the PR ready, never draft, with `gh pr create --draft=false`.
- [ ] Run the repo's lint and typecheck once before the PR-facing push.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `~/.agents/skills/poteto-mode/references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, re-run the full local gate. Typecheck, lint, tests, and the PR's perf probe, interleaved with the trunk baseline.
- [ ] One audit lane reads the diff and the receipts and distrusts the PR body.
- [ ] Clean only when every lane passes. Findings go back into the same PR. A new head gets a fresh verdict.
- [ ] The operator reviews any gated PR in chat, then squash-merges bottom-up. The agent never merges.

### Boot recipe, for every live lane

Each lane runs locally at the PR head. The surface is the browser at `http://localhost:3000`, driven through the `agent-browser` skill.

- [ ] `git fetch origin && git checkout <head SHA>`.
- [ ] Start `npm run convex` and `npm run dev`. Wait for both ready lines.
- [ ] Deliver input only through `agent-browser` commands. Read-only diagnostics through `curl http://localhost:3000/api/health`.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/lane-<n>-<slug>.png` and return the paths with the report.

## Fix user credential resolution in the worker (PR1)

**Depends on.** PR2, for the build gate.

**Files.**

- [ ] Edit `convex/userConfigActions.ts`.
- [ ] Edit `convex/internalActions.ts`.
- [ ] Create `convex/__tests__/user-credential-resolution.test.ts`.

**Build.**

- [ ] Add `getUserConfigByUserIdInternal` to `convex/userConfigActions.ts`. An `internalQuery` with `args: { userId: v.string() }` that reads `userConfigs` through the `by_user` index and decrypts the key the same way the existing internal action does.
- [ ] In `resolveCredentialsForWorker` (`convex/internalActions.ts:121`), replace the `getUserConfigInternal` call in the `source === 'user'` branch with `ctx.runQuery(internal.userConfigActions.getUserConfigByUserIdInternal, { userId })`. The `userId` parameter already exists and is already passed at both callsites.
- [ ] Write the failing test first. Assert the worker path resolves a user key with `ctx.auth.getUserIdentity` mocked to return null. Run it red, then make it green.

**You see.**

- [ ] The new test fails before the fix with "Failed to resolve credentials" semantics and passes after.
- [ ] `generatePhase.ts` still uses the identity-based `getUserConfigInternal` in the action context. That path has auth and keeps working.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `convex/__tests__/user-credential-resolution.test.ts` covers three cases. User key resolved by `userId` with null identity. System key still resolved. Missing key fails the task with the existing error string. Run `npm run test -- convex/`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `glm-5.3-flash-high` at the PR head, per the boot recipe. In this harness the lane model is the in-session agent, and Appendix C records the substitution. Requires the operator to enter a real user API key for one provider in Settings.

- [ ] Lane 1. Configure a user key, create a project, answer the required questions, generate one phase. Save `lane1-user-key-generates.png`. Pass when the artifact reaches `streamStatus: 'complete'` and the task shows `completed`.
- [ ] Lane 2. Run generate-all across phases with the same user key. Save `lane2-chain-completes.png`. Pass when every planned section in every phase completes under the user credential.
- [ ] Lane 3. Generate phase questions with the user key. Save `lane3-questions-type.png`. Pass when a `type: 'questions'` task completes and suggestions appear on the questions panel.
- [ ] Lane 4. Switch the provider to a system credential and generate. Save `lane4-system-key-still-works.png`. Pass when the artifact completes through the system path.
- [ ] Lane 5. Remove both keys and generate. Save `lane5-no-key-fails-clean.png`. Pass when the task fails with the credentials error and the phase card shows the error, not a crash.
- [ ] Lane 6. Cancel a generation mid-plan with a user key. Save `lane6-cancel-preserves.png`. Pass when partial content persists and `streamStatus` reads `cancelled`.
- [ ] Lane 7. Rotate the user key in Settings, then generate again. Save `lane7-rotated-key.png`. Pass when generation succeeds with the new key and no project recreation, proving worker-time resolution.
- [ ] Lane 8. Configure a user key on a second provider and generate with it. Save `lane8-second-provider.png`. Pass when the resolver picks the credential matching the selected provider.
- [ ] Lane 9. Set the Z.AI endpoint toggle to coding and generate. Save `lane9-zai-variant.png`. Pass when the variant fields reach the provider call and the response lands. Skip with evidence if the operator has no Z.AI key.
- [ ] Lane 10. Open the admin activity page after the runs. Save `lane10-audit-trail.png`. Pass when the runs appear with user attribution and no key material in any field.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Generation tasks with `metadata.credentials.source: 'user'` that reach `completed`.
- [ ] Probe. Run one user-key generation at trunk and one at the head, in that order, on the same dev deployment.
- [ ] Baseline. Trunk task fails with "Failed to resolve credentials". Record the task id.
- [ ] Rule. The head task completes and the trunk task does not. Anything else fails the PR.

**Review gate.** None. PR1 is not review-gated.

**Merge.**

- [ ] Clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk.
- [ ] The operator squash-merges.

## Add a production build and real typegen to CI (PR2)

**Depends on.** None. PR2 is first.

**Files.**

- [ ] Edit `.github/workflows/ci.yml`.
- [ ] Edit `package.json`.
- [ ] Create `.nvmrc`.
- [ ] Delete `bun.lock`.

**Build.**

- [ ] Replace `oven-sh/setup-bun` with `actions/setup-node@v4`, node 22, and `npm ci`.
- [ ] Change `bunx convex codegen --typecheck=disable` to `npx convex codegen --no-typecheck=off` semantics, meaning plain `npx convex codegen` so codegen errors fail CI. The secrets block stays.
- [ ] Add a build step after typecheck. `npm run build` with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder` and `CLERK_SECRET_KEY=sk_test_placeholder` env so the build can compile without real Clerk.
- [ ] Add `"engines": { "node": ">=20.9" }` to `package.json` and `.nvmrc` with `22`.
- [ ] Delete `bun.lock`. npm is the toolchain, per `AGENTS.md` and the newer `package-lock.json`.

**You see.**

- [ ] A green CI run on the PR that includes a `build` step log ending in a route table.
- [ ] `git ls-files | grep bun.lock` returns nothing.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `npm ci && npm run lint && npm run typecheck && npm run build` passes locally in a clean clone state.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `glm-5.3-flash-high` at the PR head, per the boot recipe. In this harness the lane model is the in-session agent, and Appendix C records the substitution. The surface for this PR is the GitHub Actions run page, driven with `gh run view` and the browser instead of localhost.

- [ ] Lane 1. The CI run on the PR head. Save `lane1-ci-green.png` of the summary page. Pass when the build, lint, typecheck, and test steps all succeed.
- [ ] Lane 2. Push a scratch commit that imports a missing module. Save `lane2-ci-catches-build.png`. Pass when the build step fails, then revert and watch the next run go green.
- [ ] Lane 3. Push a scratch commit with a broken Convex schema. Save `lane3-ci-catches-codegen.png`. Pass when the codegen step fails, then revert.
- [ ] Lane 4. Push a scratch commit with a lint error. Save `lane4-ci-catches-lint.png`. Pass when the lint step fails, then revert.
- [ ] Lane 5. Push a scratch commit with a type error. Save `lane5-ci-catches-typecheck.png`. Pass when the typecheck step fails, then revert.
- [ ] Lane 6. Push a scratch commit with a failing assertion. Save `lane6-ci-catches-test.png`. Pass when the test step fails, then revert.
- [ ] Lane 7. Push to main after merge. Save `lane7-main-triggers.png`. Pass when a run starts on main without a pull request.
- [ ] Lane 8. Open the raw logs of the green run. Save `lane8-secrets-masked.png`. Pass when no secret value appears in plaintext anywhere in the log.
- [ ] Lane 9. Read the setup step logs. Save `lane9-node-22.png`. Pass when setup reports node 22 from `.nvmrc`.
- [ ] Lane 10. Read the build step logs. Save `lane10-build-routes.png`. Pass when `next build` prints the route table.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. CI wall time, green run to green run.
- [ ] Probe. `gh run watch` timestamps on trunk and on the head, one run each.
- [ ] Baseline. Record the trunk duration first. The audit session measured the local suite at 3.7 minutes, so expect roughly that plus the build.
- [ ] Rule. Head duration is at most trunk duration plus 5 minutes. The added build must not triple CI time.

**Review gate.** None. PR2 is not review-gated.

**Merge.**

- [ ] Clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk.
- [ ] The operator squash-merges.

## Refresh the fallback model registry (PR3)

**Depends on.** PR1 in the stack, no code dependency.

**Files.**

- [ ] Edit `lib/llm/model-data.ts`.
- [ ] Edit `lib/llm/__tests__/registry.test.ts`.

**Build.**

- [ ] First box, evidence gathering. Run `curl -s --compressed https://models.dev/api.json | jq '.openai.models | keys[]' | head -40` in a network that can reach models.dev. Pin the exact replacement ids in the PR body. The audit sandbox could not fetch this endpoint, so the ids are set from this evidence, not from memory.
- [ ] Replace the `gpt-4o` and `gpt-4o-mini` entries in `FALLBACK_REGISTRY` with the current-generation ids from that fetch, one flagship and one small model.
- [ ] Keep `deepseek-chat` or move it to the current DeepSeek default the same fetch shows.
- [ ] Confirm the daily models.dev cron (`convex/cron.ts`) keeps the DB directory fresh, so DB rows and the hardcoded fallback agree within a day.

**You see.**

- [ ] `getModelById('<new flagship id>')` returns an entry and `getModelById('gpt-4o')` returns undefined in a node REPL.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `lib/llm/__tests__/registry.test.ts` drops the gpt-4o expectations and asserts the new ids resolve with provider `openai` and nonzero token limits. Run `npm run test -- lib/llm/`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `glm-5.3-flash-high` at the PR head, per the boot recipe. In this harness the lane model is the in-session agent, and Appendix C records the substitution.

- [ ] Lane 1. Open the phase page model selector. Save `lane1-selector-shows-new-models.png`. Pass when the new flagship id appears as selectable for OpenAI.
- [ ] Lane 2. Generate one section with the new default model. Save `lane2-generates-on-new-model.png`. Pass when the artifact appends content and the task completes.
- [ ] Lane 3. Open the finished artifact's provenance block. Save `lane3-provenance.png`. Pass when `modelProvider` reads openai and `modelId` matches the list pinned in the PR body.
- [ ] Lane 4. Open the admin llm-models page. Save `lane4-admin-models.png`. Pass when DB-enabled models still render and toggle.
- [ ] Lane 5. Trigger the models.dev cache refresh cron. Save `lane5-directory-cache.png`. Pass when `modelDirectoryCache` gains a fresh `fetchedAt` after the run.
- [ ] Lane 6. Open a legacy project whose stored model row still names gpt-4o. Save `lane6-legacy-row.png`. Pass when the row renders and generates through the generic client or prompts a clean reselect, with no crash.
- [ ] Lane 7. Generate one section with DeepSeek's current default. Save `lane7-deepseek.png`. Pass when the id from the PR body's pinned list completes a section.
- [ ] Lane 8. Attempt a provider-model mismatch. Save `lane8-mismatch-guard.png`. Pass when the validation error from `validateProviderModelMatch` appears and nothing generates.
- [ ] Lane 9. Read the selector labels. Save `lane9-display-name.png`. Pass when entries show display names, not raw ids, through `getModelDisplayName`.
- [ ] Lane 10. Open the settings llm-config page. Save `lane10-settings-default.png`. Pass when the provider default shown is the new id.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Registry resolution result, not timing.
- [ ] Probe. `node -e "const {getModelById}=require('./lib/llm/model-data')"` style resolution of old and new ids at trunk and head.
- [ ] Baseline. Trunk resolves `gpt-4o`, head does not.
- [ ] Rule. Head resolves every id listed in the PR body and none of the removed ones.

**Review gate.** None. PR3 is not review-gated.

**Merge.**

- [ ] Clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk.
- [ ] The operator squash-merges.

## Migrate Tailwind to v4 (PR4)

**Depends on.** PR2, for the build gate. Stacked above PR3.

**Files.**

- [ ] Edit `app/globals.css`.
- [ ] Edit `package.json`.
- [ ] Edit `lib/utils.ts`.
- [ ] Delete `tailwind.config.js`.
- [ ] Edit or delete `postcss.config.js`.
- [ ] Touch class names across `components/` and `app/` only where the codemod flags them.

**Build.**

- [ ] Baseline first, before any edit. On trunk, capture screenshots of the landing page, dashboard, one project phase page, the admin dashboard, and sign-in, in light and dark. Save to `/tmp/swarm-PR4/baseline/`. These are the parity reference.
- [ ] Run `npx @tailwindcss/upgrade`. Let it rewrite `globals.css` to `@import "tailwindcss"` and `@theme` tokens.
- [ ] Delete `tailwind.config.js`. Move any custom tokens it holds into `@theme` in `globals.css`.
- [ ] Replace `tailwindcss-animate` with `tw-animate-css` imported in `globals.css`.
- [ ] Replace `postcss.config.js` plugins with `@tailwindcss/postcss` and drop `autoprefixer`.
- [ ] Bump `tailwind-merge` to 3.x. Its v3 line targets Tailwind 4 class rules.
- [ ] Fix every codemod warning. Registry-item shadcn components included.

**You see.**

- [ ] `npm run build` compiles and the CSS output name in `.next` changes to the v4 pipeline.
- [ ] `git ls-files | grep tailwind.config` returns nothing.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Full suite green. `npm run test`. The `cn()` utility tests and component tests must pass untouched, which catches tailwind-merge regressions.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `glm-5.3-flash-high` at the PR head, per the boot recipe. In this harness the lane model is the in-session agent, and Appendix C records the substitution. Each screenshot is compared against the PR4 baseline set captured on trunk before any edit.

- [ ] Lane 1. Landing page, light, full page. Save `lane1-landing-light.png`. Pass when layout, spacing, and colors match the baseline and no element shifts more than a few pixels.
- [ ] Lane 2. Landing page, dark. Save `lane2-landing-dark.png`. Pass when the dark palette matches the baseline with no unstyled elements.
- [ ] Lane 3. Dashboard, light. Save `lane3-dashboard-light.png`. Pass when cards, sidebar, and stat tiles match the baseline.
- [ ] Lane 4. Dashboard, dark. Save `lane4-dashboard-dark.png`. Pass when the dashboard matches the baseline in dark mode with no unstyled elements.
- [ ] Lane 5. Project phase page with a generated artifact open. Save `lane5-phase-artifact.png`. Pass when markdown typography and mermaid blocks render as on trunk.
- [ ] Lane 6. Admin dashboard. Save `lane6-admin.png`. Pass when tables and badges match.
- [ ] Lane 7. Sign-in page. Save `lane7-signin.png`. Pass when the Clerk component renders styled.
- [ ] Lane 8. A dialog and a dropdown open from the dashboard. Save `lane8-overlays.png`. Pass when overlay animations still run, which proves `tw-animate-css` replaced `tailwindcss-animate`.
- [ ] Lane 9. Mobile viewport at 390px on the phase page. Save `lane9-mobile.png`. Pass when the responsive breakpoints hold.
- [ ] Lane 10. Toggle theme three times fast. Save `lane10-theme-toggle.png`. Pass when no unstyled flash appears.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. First-load JS and total CSS bytes for the `/` route from `npm run build` output.
- [ ] Probe. Build at trunk, record the two numbers. Build at head, record again.
- [ ] Baseline. Record the trunk numbers first and paste them in the PR body.
- [ ] Rule. Head CSS is at most 110 percent of trunk CSS. Head first-load JS is within 5 percent of trunk.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 4, 5, and 8 screenshots into `docs/plans/media/PR4-review/`.
- [ ] Record a 30 to 60 second video of landing, dashboard, and a dialog open. Save it as `docs/plans/media/PR4-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator.

**Merge.**

- [ ] Clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk.
- [ ] The operator squash-merges.

## Upgrade the dependency majors (PR5)

**Depends on.** PR4, which already lands `tailwind-merge` 3.x.

**Files.**

- [ ] Edit `package.json` and `package-lock.json` through installs.
- [ ] Touch `lib/motion.ts` and `components/ui/motion.tsx` for the motion rename.
- [ ] Touch imports across `components/` where lucide or motion names changed.

**Build.**

- [ ] One commit per upgrade, each commit green. The stack proves each dependency on its own.
- [ ] `convex` to 1.45.0 and run `npx convex codegen`.
- [ ] `@clerk/nextjs` to 7.9.1. Its peers accept `next ^16.1.0` and `react ~19.2.3`, both verified against the registry on September 8, 2026. Read the Clerk v7 migration guide and fix its breaking changes.
- [ ] `vitest` to 5.0.0 with `@vitest/coverage-v8` 5.0.0. The pair is locked by peer dependency.
- [ ] `eslint` to 10.10.0. `eslint-config-next` 16.3.4 peers `eslint >=9`, so run the suite and fix what surfaces. `@typescript-eslint` 8.70 peers `eslint ^10`.
- [ ] Replace `framer-motion` with `motion` 13.2.0. Change imports to `motion/react`.
- [ ] `lucide-react` to 1.43.0 and fix renamed icons.
- [ ] Keep `typescript` at 5.9.3. TypeScript 7.0.2 is blocked. `@typescript-eslint` 8.70.0 peers `typescript >=4.8.4 <6.1.0`, and no stable 6.x release exists. Revisit when the plugin ships TS 7 support. Record this in the PR body.

**You see.**

- [ ] Eight commits in the PR, one per dependency, each with a green local gate.
- [ ] `npm ls framer-motion` returns empty after the motion rename.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Full suite green on the final head. `npm run test`. Plus `npm run typecheck` and `npm run lint`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `glm-5.3-flash-high` at the PR head, per the boot recipe. In this harness the lane model is the in-session agent, and Appendix C records the substitution.

- [ ] Lane 1. Sign in and sign out. Save `lane1-clerk7-auth.png`. Pass when both flows complete on the Clerk 7 package.
- [ ] Lane 2. Open the landing marquee and a dialog. Save `lane2-motion13.png`. Pass when animations run on the `motion` package.
- [ ] Lane 3. Generate one phase end to end. Save `lane3-convex145-generates.png`. Pass when the chained worker completes against Convex 1.45.
- [ ] Lane 4. Toggle the theme and fire a toast. Save `lane4-ui-regressions.png`. Pass when next-themes, sonner, and lucide 1.x icons all render.
- [ ] Lane 5. Run the full vitest suite on vitest 5. Save `lane5-vitest5.png` of the terminal summary. Pass when every file and test passes.
- [ ] Lane 6. Run lint on eslint 10. Save `lane6-eslint10.png`. Pass when it exits clean with zero warnings.
- [ ] Lane 7. Run coverage. Save `lane7-coverage.png`. Pass when `@vitest/coverage-v8` 5.0 reports a summary table.
- [ ] Lane 8. Open the admin dashboard, the heaviest page. Save `lane8-admin-busy.png`. Pass when tables, badges, and charts render under Clerk 7 and motion 13.
- [ ] Lane 9. Save a user config in settings. Save `lane9-settings-save.png`. Pass when the save round-trips through the Clerk 7 middleware and Convex 1.45.
- [ ] Lane 10. Complete a sign-up with a fresh test account. Save `lane10-signup.png`. Pass when Clerk 7 sign-up lands on the dashboard.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Full vitest suite duration.
- [ ] Probe. `npm run test` timed at trunk and at head, same machine, same order.
- [ ] Baseline. Record fresh trunk time first. The audit measured 219 seconds on September 8, 2026.
- [ ] Rule. Head is at most 120 percent of the fresh trunk baseline.

**Review gate.** None. PR5 is not review-gated.

**Merge.**

- [ ] Clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk.
- [ ] The operator squash-merges.

## Enforce no-explicit-any and burn down existing anys (PR6)

**Depends on.** PR5, for eslint 10.

**Files.**

- [ ] Edit `eslint.config.js`.
- [ ] Touch every file the new rule flags. `convex/internalActions.ts` starts with at least three.

**Build.**

- [ ] Count first. `rg -n ": any|as any|any\\[\\]" --glob '!convex/_generated/**' -c` at the head of PR5. Record the number in the PR body.
- [ ] Add `@typescript-eslint/recommended` and set `@typescript-eslint/no-explicit-any: error` in `eslint.config.js`.
- [ ] Fix every site the rule flags. Prefer the real type. For Convex `ctx` parameters, import `ActionCtx`, `QueryCtx`, or `MutationCtx` from `./_generated/server`. For the decrypted-config loop, type the credential shape explicitly.
- [ ] Keep `AGENTS.md`'s no-new-`any` rule true by construction from now on.

**You see.**

- [ ] `npm run lint` fails on trunk-with-rule and passes at the head.
- [ ] The recorded count goes to zero.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Full suite and typecheck green after the type tightening. Real types can change inference. `npm run typecheck && npm run test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `glm-5.3-flash-high` at the PR head, per the boot recipe. In this harness the lane model is the in-session agent, and Appendix C records the substitution.

- [ ] Lane 1. Generate one phase end to end. Save `lane1-generation-unbroken.png`. Pass when the typed credential path still resolves and completes. This is the path the refactor touched.
- [ ] Lane 2. Push a scratch commit that adds one `any` annotation. Save `lane2-lint-catches-any.png`. Pass when lint fails on it, then revert and watch it pass.
- [ ] Lane 3. Generate phase questions. Save `lane3-questions-typed.png`. Pass when the typed question shapes still produce suggestions.
- [ ] Lane 4. Export a project as ZIP and copy a clipboard format. Save `lane4-export.png`. Pass when both produce output identical to trunk.
- [ ] Lane 5. Wait for the models.dev cron. Save `lane5-cron-fires.png`. Pass when the cache table updates with the typed client in place.
- [ ] Lane 6. Generate and open the activity feed. Save `lane6-activity-log.png`. Pass when generation events land with the typed writers.
- [ ] Lane 7. Visit every admin route. Save `lane7-admin-render.png`. Pass when each renders without a runtime type error.
- [ ] Lane 8. Open the notifications bell and mark one read. Save `lane8-notifications.png`. Pass when the state change persists.
- [ ] Lane 9. Run typecheck. Save `lane9-typecheck.png`. Pass when `tsc` is clean with the real `ActionCtx` and `QueryCtx` types in place.
- [ ] Lane 10. Run the full suite. Save `lane10-suite.png`. Pass when every file and test passes after the type tightening.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Count of `any` occurrences outside `convex/_generated/`.
- [ ] Probe. The `rg` count command, run at trunk and at head.
- [ ] Baseline. The trunk count recorded in the PR body.
- [ ] Rule. Head count is exactly zero.

**Review gate.** None. PR6 is not review-gated.

**Merge.**

- [ ] Clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk.
- [ ] The operator squash-merges.

## Stream tokens for the first artifact section (PR7)

**Depends on.** PR5. Stacked above PR6 so UI files land after the motion rename churn.

**Files.**

- [ ] Edit `lib/llm/base-provider.ts`.
- [ ] Edit `lib/llm/providers/openai.ts` and the OpenAI-compatible providers.
- [ ] Edit `convex/internalActions.ts`.
- [ ] Edit `convex/internal.ts` if the append mutation needs a delta variant.
- [ ] Edit `components/streaming-artifact-preview.tsx`.

**Build.**

- [ ] First box, a spike on a scratch branch, not this PR. Wire one OpenAI call with `stream: true`, parse the SSE chunks, and print first-byte latency plus chunk cadence. Also measure the cost of patching the artifact row at 250 millisecond and 1 second intervals through the existing append mutation. Record both numbers in Appendix A of this plan before writing PR7 code.
- [ ] Design that the spike must confirm. The provider layer gains a `streamSection` method that yields text deltas. The worker consumes it and appends to the artifact row on a throttled cadence, no faster than the spike says is safe. The first section streams live. Later sections keep the existing whole-section writes.
- [ ] Implement behind the existing `streamStatus` fields. No schema change.
- [ ] Keep cancel semantics. Cancel mid-stream persists what arrived and marks `cancelled`.
- [ ] Keep the non-streaming path as fallback for providers whose SSE shape differs, selected by provider capability.

**You see.**

- [ ] On a generation, the artifact preview paints words as they arrive during section one, with the activity log showing the first delta timestamp.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `lib/llm/__tests__/` gains a stream parser test. Feed a recorded SSE fixture, assert the emitted deltas join to the full text. Assert the throttle emits at most one append per interval. Run `npm run test -- lib/llm/`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `glm-5.3-flash-high` at the PR head, per the boot recipe. In this harness the lane model is the in-session agent, and Appendix C records the substitution. Lanes need a real provider key.

- [ ] Lane 1. Generate a phase and watch section one paint progressively. Save `lane1-streams.mp4`. Pass when text appears incrementally before the section completes.
- [ ] Lane 2. Cancel at ten seconds into the stream. Save `lane2-cancel-mid-stream.png`. Pass when partial text persists and status reads `cancelled`.
- [ ] Lane 3. Generate on a non-streaming-capable provider. Save `lane3-fallback-path.png`. Pass when generation still completes through the fallback selection.
- [ ] Lane 4. Generate with the network throttled to slow 3G in devtools. Save `lane4-slow-network.png`. Pass when the UI shows streaming state without stale or duplicated text.
- [ ] Lane 5. Watch section two onward. Save `lane5-later-sections-chunked.png`. Pass when later sections complete as whole writes, as on trunk.
- [ ] Lane 6. Read `streamStatus` during and after. Save `lane6-status-transitions.png`. Pass when it moves idle, streaming, complete in order.
- [ ] Lane 7. Read the activity log. Save `lane7-first-delta-log.png`. Pass when the log carries the first-delta timestamp the perf probe parses.
- [ ] Lane 8. Run two generations in parallel. Save `lane8-parallel-streams.png`. Pass when each artifact shows only its own text and no interleaving.
- [ ] Lane 9. Open version history after the stream completes. Save `lane9-version-saved.png`. Pass when `artifactVersions` records the final content and rollback still works.
- [ ] Lane 10. Generate a section whose output contains a mermaid block. Save `lane10-mermaid-after-stream.png`. Pass when the diagram renders after completion through the existing splitter.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Seconds from generation start to first text painted in the artifact preview.
- [ ] Probe. One generation at trunk and one at head, reading the activity log's first-delta timestamp against the task start.
- [ ] Baseline. Trunk paints nothing until the whole section returns. Record the section-one completion time.
- [ ] Rule. Head paints first text within 5 seconds of the provider's first byte. Trunk cannot do this at all.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1 video and lane 2 screenshot into `docs/plans/media/`.
- [ ] Post them in chat with the spike numbers from Appendix A. Stop at merge-ready. Wait for the operator.

**Merge.**

- [ ] Clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk.
- [ ] The operator squash-merges.

## Consolidate agent docs and add a Playwright smoke test (PR8)

**Depends on.** PR7, so docs describe the final state.

**Files.**

- [ ] Delete `CLAUDE.md` and `components/CLAUDE.md`.
- [ ] Edit `AGENTS.md`, `components/AGENTS.md`, `convex/AGENTS.md`, `lib/AGENTS.md`.
- [ ] Edit `README.md`.
- [ ] Edit `.github/workflows/ci.yml`.
- [ ] Create `playwright.config.ts` and `e2e/smoke.spec.ts`.

**Build.**

- [ ] Move any unique rule from the two CLAUDE.md files into the AGENTS.md files, then delete them. Two doc sources become one per directory.
- [ ] Rewrite `README.md`. Node 20.9 or newer, npm only, current feature list including admin and dashboard, and the real scripts. Remove the Bun runtime claim.
- [ ] Add Playwright. `e2e/smoke.spec.ts` covers four steps. Landing loads. Sign-in renders the Clerk component in test mode. Create a project from a brief. The dashboard lists it.
- [ ] Wire an `e2e` job into CI behind the existing secrets, with Clerk test keys. The test stubs authenticated state rather than running real generation, so CI needs no LLM keys.

**You see.**

- [ ] `git ls-files | grep CLAUDE.md` returns nothing.
- [ ] `npm run test:e2e` opens the browser, runs the four steps, and prints green.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] The vitest suite stays green. `npm run test`.
- [ ] The Playwright suite passes locally twice in a row, which catches flaky selectors.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `glm-5.3-flash-high` at the PR head, per the boot recipe. In this harness the lane model is the in-session agent, and Appendix C records the substitution.

- [ ] Lane 1. The full smoke test against the local stack. Save `lane1-smoke-green.png`. Pass when all four steps assert.
- [ ] Lane 2. The CI run on the PR head includes the e2e job. Save `lane2-ci-e2e.png` of the run page. Pass when the job succeeds without LLM secrets.
- [ ] Lane 3. Follow the new README quickstart in a clean clone. Save `lane3-quickstart.png`. Pass when the stack starts and the dashboard loads with no steps outside the README.
- [ ] Lane 4. Search the tree for removed docs. Save `lane4-docs-source.png`. Pass when `git ls-files | grep CLAUDE.md` returns nothing.
- [ ] Lane 5. Run the smoke suite twice in a row. Save `lane5-smoke-twice.png`. Pass when both runs are green, which catches flaky selectors.
- [ ] Lane 6. Read the total CI wall time on the run page. Save `lane6-ci-time.png`. Pass when it stays under 15 minutes.
- [ ] Lane 7. Run the smoke with no LLM keys configured at all. Save `lane7-stub-auth.png`. Pass when the auth stub carries the test past sign-in.
- [ ] Lane 8. Watch the project creation step. Save `lane8-create-project.png`. Pass when the e2e creates a project from a brief form.
- [ ] Lane 9. Watch the dashboard listing step. Save `lane9-dashboard-lists.png`. Pass when the e2e asserts the new project row.
- [ ] Lane 10. Push a scratch commit that breaks one selector. Save `lane10-trace-on-fail.png`. Pass when Playwright emits a trace artifact, then revert.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Smoke suite duration and total CI wall time.
- [ ] Probe. Time both locally and read the CI run duration.
- [ ] Baseline. PR5's recorded CI time.
- [ ] Rule. Smoke under 3 minutes. Total CI under 15 minutes.

**Review gate.** None. PR8 is not review-gated.

**Merge.**

- [ ] Clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto current trunk.
- [ ] The operator squash-merges.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] The final report states, per PR, the head SHA, the verdict, the perf numbers against baseline, and the merge SHA. It names the one bug fixed, the versions gained, and the tooling now enforced.

## Appendix A. Prototype evidence

- **OpenAI model ids for PR3.** Unproven. The audit sandbox reached models.dev but received an empty body, twice, with http 200. PR3's first box fetches the directory in a permitted network and pins the ids from that output. Do not write the ids from memory.
- **TypeScript 7 blocked.** Proven from the registry on September 8, 2026. `@typescript-eslint` 8.70.0 peers `typescript >=4.8.4 <6.1.0`. TypeScript dist-tags show `latest: 7.0.2` and `beta: 6.0.0`, so no stable version satisfies the peer range above 5.9.x. PR5 keeps 5.9.3.
- **Clerk 7 compatibility.** Proven from the registry. `@clerk/nextjs` 7.9.1 peers include `next ^16.1.0` and `react ~19.2.3`. The installed next 16.1.1 and react 19.2.3 satisfy it. Runtime breaking changes still surface in PR5's lane 1.
- **Vitest 5 pairing.** Proven from the registry. `@vitest/coverage-v8` 5.0.0 peers exactly `vitest 5.0.0`. They upgrade together.
- **Streaming patch cadence for PR7.** Unproven. The spike is PR7's first box. Both the safe append interval and first-byte latency need measurement on the real deployment before the design is written.

## Appendix B. Alternatives rejected

- **Bun everywhere instead of npm.** Rejected. The local machine's node install has no bun binary, `AGENTS.md` says npm, and `package-lock.json` is newer than `bun.lock`. One toolchain wins, and it is npm.
- **TypeScript 7 now.** Rejected on the proven peer conflict above. Revisit when `@typescript-eslint` supports it.
- **Replace the chained-worker architecture.** Rejected. Long jobs still need chaining on Convex action timeouts. The audit found the pattern sound.
- **Keep framer-motion instead of the rename.** Rejected. `framer-motion` 12 stays on the old line while `motion` 13 is the maintained package. The rename is a mechanical import change isolated in `lib/motion.ts` and `components/ui/motion.tsx`.
- **Real token streaming for every section.** Rejected for this program. Convex append mutations through the worker make per-token writes risky at unknown cadence. First-section streaming plus the spike numbers decide whether to extend.

## Appendix C. Risks

- **No subagent machinery in this harness.** The playbook expects one owner per PR as separate agents. One in-session agent owns all eight. Mitigation is the linear stack, the per-PR gates, and the operator's merges. Drift risk concentrates in one context window, so the agent re-reads the plan at every PR boundary.
- **Lane model.** The playbook's live-lane line names `grok-4.6-fast-xhigh` per lane. On September 8, 2026 the operator replaced that default with `glm-5.3-flash-high` for this program's lanes. This harness exposes no per-lane model configuration, so lanes run on the in-session agent. The ten-lane count, screenshots, and pass predicates stay as written. The check script hardcodes the playbook default, so its eight lane-model findings after this override are expected and sanctioned.
- **PR2's lane surface.** The boot recipe drives localhost, but PR2 verifies CI behavior. Its lanes drive the GitHub Actions run page with `gh run view` and the browser instead.
- **No cloud VMs for lanes.** Lanes run on the operator's machine. The live lanes for PR1, PR3, and PR7 need real provider keys and a dev Convex deployment the operator must supply.
- **Trunk is dirty.** Eight admin pages have uncommitted changes. The cleanup box in Spawn owners runs before PR1 or every diff lies.
- **Clerk 7 runtime breaks.** Peer ranges pass but majors can still move behavior. PR5's lane 1 is the catcher, and the one-commit-per-upgrade rule localizes any breakage.
- **Tailwind 4 visual drift.** The codemod misses custom or dynamic classes. The ten-lane parity set and the review gate catch it. `mermaid` and `sanitize-html` rendering are the likeliest subtle spots.
- **CI build needs placeholder Clerk keys.** `next build` compiles pages that read Clerk env at build time. If placeholders fail, the build step uses `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from CI secrets as a test key instead.
- **Sandbox tool quirk.** The audit sandbox's node install lacks an `npm` shim, so local gates ran through `node node_modules/&lt;pkg&gt;/bin/&lt;tool&gt;`. If that persists, run the same commands that way; the plan's `npm run` form stays canonical.

## Appendix D. Links and reading list

- Convex scheduling and auth. Scheduled functions carry no user identity. This is PR1's root cause. Read before PR1.
- Clerk v7 migration guide. Read before PR5.
- Tailwind v4 upgrade guide and `@tailwindcss/upgrade` notes. Read before PR4.
- `tailwind-merge` v3 release notes. Read before PR4.
- Vitest 5 release notes and `@vitest/coverage-v8` pairing. Read before PR5.
- ESLint 10 changes and flat config. Read before PR5 and PR6.
- `motion` React migration from `framer-motion`. Read before PR5.
- models.dev directory shape. Read before PR3, alongside the fetch box.
- PR7 gets the `interrogate` treatment before implementation, since its design is the one contested choice in this program. PR4 gets `how` for a walkthrough of the styling pipeline before the migration.
- The decision trail per `~/.agents/skills/show-me-your-work/SKILL.md` stays local. Commit it only if the operator asks for an auditable record.
