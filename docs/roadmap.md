# SpecForge Roadmap

**Updated:** September 29, 2026

## Current phase

| Phase | State | Spec | Plan |
| --- | --- | --- | --- |
| 1. Evidence-backed specifications | Active: live deployment walkthrough pending | [Evidence-backed specifications](specs/2026-09-22-evidence-backed-specs.md) | [Implementation plan](plans/2026-09-22-evidence-backed-specs.md) |
| 2. Guided three-stage workflow | Complete | [Guided three-stage workflow](specs/2026-09-25-guided-workflow.md) | - |
| 3. Ember redesign | Complete | [Ember redesign](specs/2026-09-25-ember-redesign.md) | - |
| 4. Stage prompts and requirement quality | Complete | [Stage prompts and requirement quality](specs/2026-09-26-stage-prompts-and-requirement-quality.md) | - |
| 5. Magenta brand | Complete | [Magenta brand](specs/2026-09-27-magenta-brand.md) | - |
| 6. Workflow and navigation | Complete | [Workflow and navigation](specs/2026-09-27-workflow-navigation.md) | - |
| 7. Change and bug-fix specs | Complete | [Change and bug-fix specs](specs/2026-09-27-change-specs.md) | - |
| 8. Pull-request verification | Complete | [Pull-request verification](specs/2026-09-27-pull-request-verification.md) | - |
| 9. Agent connection over MCP | On hold: spec written, no plan or code until resumed | [Agent connection over MCP](specs/2026-09-28-agent-connection.md) | - |

The local implementation and repository gates are complete for phases 2, 3 and 4. The remaining rollout
check on phase 1 needs a configured Convex development deployment and GitHub OAuth credentials.

Phase 3 replaced the brutalist visual system with Ember and turned the generated specification into a
reading surface. [ADR 0001](adr/0001-ember-design-system.md) records the decision and what it
supersedes, including the page composition from phase 2. The implementation plan is deleted, as the
lifecycle requires of a finished plan; the evidence it produced is in `design/decisions.tsv`,
`design/screens/step-11/` and the ADR.

Phase 4 is complete. Every stage generates behind one prompt that states what its documents must
accomplish, every acceptance criterion carries a testability class, and a requirement-quality report
is rendered on the reading surface, marked at the section that earned it, worded in the workflow map,
and carried into the exported pack. It ran as pull requests #32, #33 and #34, its gate set exited
zero on `main` at `3048992`, and the report's captured surfaces are in `design/screens/stage-report/`.
The implementation plan is deleted, as the lifecycle requires of a finished plan. One open decision
is recorded in the guided workflow spec: the `artifacts` phase inherits the design prompt.

Phase 5 replaces Ember's palette and type with the Magenta brand the product owner chose from three
directions built on fixed grounds, a clean off-white and a true dark black.
[ADR 0002](adr/0002-magenta-brand.md) records the decision. Ember's structural decisions stand.
It ran as `0f6d7ff` (decision, spec, plan) and `19304ad` (the rollout: tokens, a 387-use rename to
semantic colour names, Funnel Display, Funnel Sans and Red Hat Mono, the section-sign mark, press
feedback, and the landing hero). At `19304ad` typecheck, lint, the suite (122 files, 841 tests), the
build, the contrast and token-sync audits, the whole-tree palette lint and this validator exited zero;
`npm run test:e2e` was not run because it needs Clerk test credentials. The live-page audit and the
captured surfaces are in `design/screens/magenta/`. The implementation plan is deleted, as the
lifecycle requires of a finished plan.

Phase 6 makes the product easier to move around. The small fixes give each mode one name, send
"Generate all phases" through the answers page, and make project creation one step with the
repository connection moved to the project page. Three project navigation prototypes are in
`design/prototypes/project-navigation.html`, with captures in `design/screens/navigation/`. The owner
chose the rail, and phase pages now carry a project sidebar with every phase and its status; the
stage band stays on the project overview. A missing model is now reported before any generation and
every generate control says why it is off, and a Quick spec can start a Lite project that holds it.
Settings and the saved quick specs page now match the rest, and weights above 600 fail the lint.

Phases 5 and 6 reached `main` together in #40 at `8f63167`, after the phase 6 work ran as #36, #37,
#38 and #39 into the brand branch. CI's test, design and e2e jobs passed on each of those pull
requests and on #40. Deploying #40 needs a Convex deploy, for the new `createProjectFromQuickSpec`
mutation.

Phase 7 lets a reader describe a feature change or a bug and review it as edits to the project's
requirements: added, reworded, removed or reaffirmed, each under its requirement ID, applied in one
transaction and exported as `changes/CHG-nnnn-<slug>.md`. A requirement now keeps its ID when its
wording changes, which [ADR 0003](adr/0003-requirement-identity-is-the-claim-id.md) records. It ran as
#42 and #43 (spec and plan) and #44 to #51 (`9439b4a`, `69485ee`, `e99fad7`, `aaa726c`, `d288e1b`,
`2dfaee4`, `959a359`, `004e9aa`). CI's test, design and e2e jobs passed on each. The walkthrough on
the dev deployment, with the real model, is in `docs/evaluations/2026-09-27-change-specs-walkthrough.md`;
it found and fixed two prompt defects, and the signed-in pages were checked through `/design`
fixtures rather than a browser. The implementation plan is deleted, as the lifecycle requires of a
finished plan. The one follow-up it left, claim extraction turning metadata bullets ("Priority",
"Trace", "Status") into requirements, is fixed: section prompts ask for each requirement under a
`**Requirement:**` label or its ID, and extraction reads those marks and skips annotations. The
walkthrough note records the before and after counts.

Phase 8 checks a pull request, a commit range or a pasted diff against the requirements it touches.
A check scopes itself from the `REQ-` and `CHG-` IDs the pull request cites, or infers the scope and
says so. It gives each requirement a verdict backed by lines quoted from the diff, and grades by a
fixed table rather than by the model, which [ADR 0004](adr/0004-a-check-grade-is-computed-from-quoted-evidence.md)
records. The diff it reads and the room it leaves the reply follow the model's context size. It ran
as #54 and #55 (spec and plan) and #56 to #61 (`8a41ba7`, `fa9240b`, `eb403e2`, `44ddf9b`,
`2dc44bd`, `6d6c0bd`), and CI's test, design and e2e jobs passed on each. The walkthrough on the dev
deployment with a reasoning model is in `docs/evaluations/2026-09-28-pull-request-verification-walkthrough.md`:
on a real change from this repository the check gave true verdicts and caught a planted bug, and it
found three defects that were fixed. The implementation plan is deleted, as the lifecycle requires
of a finished plan. One follow-up is open: the pull request picker and cited scope have not run
against GitHub, because no GitHub OAuth app is registered for the deployments; the same gap blocks
phase 1's walkthrough.

## Later phases

Each later phase gets its own spec when the phase before it exits. Phase 10 has no spec yet.

10. Jump-to palette. One keyboard entry point for clauses, phases and claims, as shown in `design/prototypes/brand-directions.html`. Deferred by phase 6: the project sidebar puts every phase one click away, so this waits until readers show they still need it.

## Historical plan index

These plan documents are retained as historical context and are not a current backlog:

- [Traycer feature parity](plans/2026-03-19-traycer-feature-parity.md)
- [Clarification artifact wiring fixes](plans/2026-03-20-clarification-artifact-wiring-fixes.md)
- [Code review remediation](plans/2026-03-20-code-review-remediation.md)
- [LLM credential resolution](plans/2026-03-20-fix-llm-credential-resolution.md)
- [September remediation snapshot](plans/2026-09-08-remediation-plan.md)
