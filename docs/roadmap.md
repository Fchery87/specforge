# SpecForge Roadmap

**Updated:** September 25, 2026

## Current phase

| Phase | State | Spec | Plan |
| --- | --- | --- | --- |
| 1. Evidence-backed specifications | Active: live deployment walkthrough pending | [Evidence-backed specifications](specs/2026-09-22-evidence-backed-specs.md) | [Implementation plan](plans/2026-09-22-evidence-backed-specs.md) |
| 2. Guided three-stage workflow | Not started | [Guided three-stage workflow](specs/2026-09-25-guided-workflow.md) | [Implementation plan](plans/2026-09-25-guided-workflow.md) |

The local implementation and repository gates are complete. The remaining rollout check needs a configured Convex development deployment and GitHub OAuth credentials.

## Later phases

Each later phase gets its own spec when the phase before it exits.

3. Stage prompts and requirement quality. Merge the prompts and stored data behind each stage, add testable acceptance criteria and a readiness check, and set a length budget per document.
4. Change and bug-fix specs. Specify a change to an existing codebase as added, modified, and removed requirements against the current spec.
5. Pull-request verification. Check a selected pull request or commit range against requirement IDs, with findings graded by severity.
6. Agent connection over MCP. Let coding agents read project rules and tasks and report task status.

## Historical plan index

These plan documents are retained as historical context and are not a current backlog:

- [Traycer feature parity](plans/2026-03-19-traycer-feature-parity.md)
- [Clarification artifact wiring fixes](plans/2026-03-20-clarification-artifact-wiring-fixes.md)
- [Code review remediation](plans/2026-03-20-code-review-remediation.md)
- [LLM credential resolution](plans/2026-03-20-fix-llm-credential-resolution.md)
- [September remediation snapshot](plans/2026-09-08-remediation-plan.md)
