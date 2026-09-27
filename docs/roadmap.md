# SpecForge Roadmap

**Updated:** September 26, 2026

## Current phase

| Phase | State | Spec | Plan |
| --- | --- | --- | --- |
| 1. Evidence-backed specifications | Active: live deployment walkthrough pending | [Evidence-backed specifications](specs/2026-09-22-evidence-backed-specs.md) | [Implementation plan](plans/2026-09-22-evidence-backed-specs.md) |
| 2. Guided three-stage workflow | Complete | [Guided three-stage workflow](specs/2026-09-25-guided-workflow.md) | - |
| 3. Ember redesign | Complete | [Ember redesign](specs/2026-09-25-ember-redesign.md) | - |
| 4. Stage prompts and requirement quality | In progress: tasks 1 to 5 of 10 finished | [Stage prompts and requirement quality](specs/2026-09-26-stage-prompts-and-requirement-quality.md) | [Implementation plan](plans/2026-09-26-stage-prompts-and-requirement-quality.md) |

The local implementation and repository gates are complete for phases 2 and 3. The remaining rollout
check on phase 1 needs a configured Convex development deployment and GitHub OAuth credentials.

Phase 3 replaced the brutalist visual system with Ember and turned the generated specification into a
reading surface. [ADR 0001](adr/0001-ember-design-system.md) records the decision and what it
supersedes, including the page composition from phase 2. The implementation plan is deleted, as the
lifecycle requires of a finished plan; the evidence it produced is in `design/decisions.tsv`,
`design/screens/step-11/` and the ADR.

Phase 4 has a spec and an open plan. It is the deferred half of phase 2: the three-stage grouping is
presented, while the prompts and the stored data behind it are still the eight phases. The spec
scopes that to one prompt per stage, testable acceptance criteria, a requirement-quality report, and a
document length budget, and it explicitly does not merge the eight phase ids. The plan runs pure
modules first, then the schema and read, then the surface and export.

## Later phases

Each later phase gets its own spec when the phase before it exits. Phases 5 to 7 have no spec yet.

5. Change and bug-fix specs. Specify a change to an existing codebase as added, modified, and removed requirements against the current spec.
6. Pull-request verification. Check a selected pull request or commit range against requirement IDs, with findings graded by severity.
7. Agent connection over MCP. Let coding agents read project rules and tasks and report task status.

## Historical plan index

These plan documents are retained as historical context and are not a current backlog:

- [Traycer feature parity](plans/2026-03-19-traycer-feature-parity.md)
- [Clarification artifact wiring fixes](plans/2026-03-20-clarification-artifact-wiring-fixes.md)
- [Code review remediation](plans/2026-03-20-code-review-remediation.md)
- [LLM credential resolution](plans/2026-03-20-fix-llm-credential-resolution.md)
- [September remediation snapshot](plans/2026-09-08-remediation-plan.md)
