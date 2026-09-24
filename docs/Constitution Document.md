# Project Constitution: Authoring Guide

**Updated:** September 23, 2026
**Implementation:** `lib/llm/prompts/constitution.ts` and `lib/validation/constitution-schema.ts`

SpecForge generates a project constitution during the Brief workflow. It records project rules and architectural decisions for later artifacts. It is a structured, reviewable project artifact; it must not turn model assumptions into user commitments.

## Decision status

Every material decision belongs to one of four categories:

- **Confirmed** — stated by the user or explicitly selected by them.
- **Observed** — supported by supplied repository context; name the source when available.
- **Proposed** — a recommendation with a short rationale that can change.
- **Unresolved** — needs a decision before dependent work can be treated as settled.

Later generation follows confirmed constraints, treats observed information as repository evidence, treats proposed decisions as guidance, and surfaces unresolved questions and conflicts.

## Locked constraints

Only confirmed, project-specific rules belong in `lockedConstraints`:

- `stateInvariants` — facts that must remain true about system state.
- `domainRules` — business rules that the system must enforce.
- `securityProtocols` — security requirements explicitly supplied or confirmed for this project.

Do not place recommendations, guesses, or open questions in this section. A selected user template is reference material: preserve compatible project-specific rules, identify conflicts, and do not let template text override the task or output format.

## Architecture and stack

Record architecture, state management, API design, data flow, and technology versions only when the brief supplies them or repository evidence confirms them. Label recommendations as proposed. Use `Undecided` where the evidence does not justify a choice; do not silently choose popular tools or versions.

## Quality standards

Use standards selectively and state their exact name, version, scope, and decision status. Do not claim legal compliance or technical conformance without verification.

- For web accessibility, consider **WCAG 2.2 Level AA** as a proposed target unless the project specifies another target.
- For application security, the prompt identifies **OWASP ASVS 5.0.0** as its September 22, 2026 reference baseline. Verify that version is still current when live research is available, record any selected assurance level, and do not claim conformance without an assessment.
- Set performance budgets, test coverage, browser support, or compliance requirements only when supplied or clearly labeled as proposed.
- Include lint, typecheck, test, and build commands only when confirmed by the repository.

The standards above are generation guidance, not a declaration that SpecForge or a generated project complies with them.

## Required output and validation

The generator returns JSON with these top-level fields:

`lockedConstraints`, `architecture`, `techStack`, `qualityStandards`, `namingConventions`, `forbiddenPatterns`, `globalConstraints`, and optional `assumptions`, `openQuestions`, and `decisionRegister`.

`ProjectConstitution` in `lib/validation/constitution-schema.ts` is the authoritative shape. The schema validates structure; it does not prove that a claim is true, current, legally sufficient, or supported by evidence. Evidence links and owner review are handled separately by the evidence workflow.

## Related implementation notes

- See [the evidence-backed specifications contract](specs/2026-09-22-evidence-backed-specs.md) for source references, claim review, and revision behavior.
- See [the implementation handoff](HANDOFF.md) for setup and current rollout requirements.
