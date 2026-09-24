# Evidence-backed specifications

**Status:** Implementation present; live deployment walkthrough pending  
**Date:** 2026-09-22  
**Plan:** [Implementation plan](../plans/2026-09-22-evidence-backed-specs.md)

## Problem

SpecForge generates a constitution, requirements, technical specifications, stories, and handoff material from project answers and optional repository context. A reader cannot reliably tell which answer or repository file supports a generated statement. When an answer or repository snapshot changes, the existing phase staleness flag identifies affected phases but does not identify the individual requirements, decisions, tickets, and verification results to review. The standalone Quick Spec flow also returns a result without placing it in a project's version and review history.

These gaps make review and implementation harder. They also make an unsupported model inference look similar to a confirmed project decision.

## Outcome

A user can trace each important requirement or decision to captured evidence, see which claims need review after a source changes, and carry stable requirement IDs into exported implementation tasks and verification findings. A small change can use the existing Quick Spec flow without entering every project phase.

The product must keep user confirmation separate from model inference. A model may suggest a link or a decision, but a model-generated link alone does not make a claim confirmed.

## Existing behavior to build on

- `convex/schema.ts` stores projects, phase questions, artifacts, artifact versions, tickets, repository scans, and verification results.
- `lib/specification/dependency-graph.ts` and `convex/internal.ts` mark downstream phases stale after regeneration.
- `lib/verification/spec-checker.ts` compares a pasted diff with artifact text. `components/verification-panel.tsx` presents the result.
- `components/export-options.tsx` exports project context, while `app/(auth)/dashboard/quick/page.tsx` generates a standalone Quick Spec.
- The constitution prompt now distinguishes confirmed, observed, proposed, and unresolved decisions. Its freeform `source` field is not a validated evidence link.

## User workflows

### Review a generated project

1. The user answers a phase question or scans a repository at a known commit.
2. SpecForge captures an immutable source revision and gives it an ID.
3. Generation proposes claims with stable IDs and references to captured source IDs.
4. A server validator checks source ownership, source existence, and locator shape. It rejects invalid links and leaves unsupported claims marked for review.
5. The artifact shows each claim's status and evidence. The user can confirm, edit, or mark a claim unresolved. Confirmation records who acted and when.

### Change a source

1. The user changes an answer or scans a newer repository commit.
2. SpecForge retains the earlier source revision and records the new one.
3. Claims linked to the earlier revision become `needs_review`. Related artifacts, tickets, and verification results show the impact.
4. The user can compare the old and new source, revise affected claims, and regenerate only affected artifacts. Accepted changes create artifact versions.
5. A stale marker clears only after the affected claims have been reviewed against current evidence. A rerun alone does not clear it.

### Implement and verify

1. The user exports an artifact or ticket with stable requirement IDs, claim status, and evidence references.
2. An implementer supplies a diff through the existing verification panel.
3. Verification findings identify requirement IDs and changed file paths where possible. The result records the artifact version and source revision set used for the check.
4. When either side changes, the previous verification result reads `outdated`; its historical result remains visible.

### Work on a small change

The existing Quick Spec form remains the short path. A user may save its result to an existing project as a versioned artifact, with optional evidence links. The standalone result remains available for users who do not need a project. Saving does not create empty phases or force the full project workflow.

A saved Quick Spec uses artifact type `quickSpec` and phase ID `quick`. The phase ID is an artifact grouping key; it does not create a row in `phases` or enter the phase dependency graph.

## Data contract

| Record | Required fields | Rule |
| --- | --- | --- |
| Evidence source | Project ID, source ID, kind, origin, locator, revision, captured time, content hash, short display excerpt | Immutable after capture. A new answer or scan creates a new revision. |
| Claim | Project ID, stable claim ID, artifact ID and version, text, kind, decision status, review status | IDs survive edits to wording where the underlying requirement remains the same. Removed claims stay in version history. |
| Evidence link | Claim ID, source ID, support status, optional locator detail | A server validates both IDs belong to the same project. An unverified model suggestion is visibly distinct from a user-confirmed link. |
| Verification result | Artifact version, source revision set, requirement IDs, diff digest, findings, checked time | A result is historical evidence for that exact input set. |

Initial source kinds are a saved question answer, a repository file at a captured commit, and a user note. Repository paths must resolve within the scanned repository. A repository scan needs a commit SHA; a moving branch name is not a stable revision. Store a bounded excerpt for display and a digest for comparison. Do not copy full repository files into each link.

Claims cover constitution decisions, PRD and technical requirements, and story acceptance criteria. Tickets refer to claim IDs rather than copying an untracked requirement string. The UI may render human-readable IDs such as `REQ-001`, but internal IDs must remain stable across sorting and editing.

Use `confirmed`, `observed`, `proposed`, or `unresolved` for decision status. Use `current` or `needs_review` for review status. Use `suggested`, `confirmed`, or `rejected` for a link's support status. A valid locator can still be `suggested`; validation checks where the link points, while review checks whether that source supports the claim.

A wording edit keeps the claim ID when the requirement's meaning stays the same. A changed obligation retires the old claim and creates a new ID. Generation may propose a match to an earlier claim, but the server must not reuse an ID on model assertion alone when the meaning is uncertain; it marks that match for review.

The initial implementation preserves IDs across exact normalized text matches during regeneration and across explicit user wording edits. It retires unmatched claims rather than attempting uncertain semantic matching.

## Rules and failure behavior

- Generation may propose evidence links only from sources included in that generation request. Unknown IDs, cross-project IDs, and malformed locators fail validation.
- Generated bullet candidates start as `proposed` and `needs_review`. The model may attach hidden source markers; the server discards markers outside the generation's captured source allowlist, and users see only the cleaned artifact text.
- A missing source produces `needs_review` rather than a fabricated citation. A user note records its author; it is not treated as independent repository evidence.
- `confirmed` means the user confirmed a claim or supplied an explicit constraint. `observed` means the captured source shows a current repository fact. `proposed` and `unresolved` remain visible as such in exports.
- A source change marks only linked claims and their dependents for review. Existing phase-level staleness remains as a summary of those affected claims.
- Verification is advisory. A passing model assessment does not prove that code is correct or that a legal, accessibility, or security standard is met.
- A project owner can view and change that project's sources and claims. Another user cannot retrieve them by guessing IDs. Logs and exports omit secrets and raw OAuth tokens.
- Legacy artifacts without claim records still render and export. They show `Evidence not captured` until the user opts into migration or regenerates them. No migration invents citations.

## Acceptance criteria

- A generated claim with a valid answer or repository reference opens the captured source revision from the artifact view.
- An unsupported claim is visibly marked for review and cannot appear as confirmed solely because the model labeled it so.
- Changing an answer or repository commit marks linked claims, dependent tickets, and previous verification results as outdated without changing unrelated claims.
- A user can review and clear an affected claim. The action records an artifact version or review event.
- Exported artifacts and tickets retain requirement IDs, statuses, and readable evidence references. Reimport is outside this release.
- The existing diff checker cites requirement IDs and the artifact version used. It rejects cross-project inputs.
- A Quick Spec can be saved into a project and later reviewed without creating unused phases.
- Existing projects and their exports continue to work without evidence records.

## Measurement

Record the baseline before setting product targets. Measure the share of generated claims with valid evidence links, the share flagged unsupported, the time to review a changed source, and the share of verification findings that cite a requirement ID. Review a small, fixed set of real project examples for false support claims. Release gates require zero broken project boundaries, zero invalid links presented as valid, and no loss of legacy artifact access. Product targets can follow the baseline and user review.

## Boundaries

This release uses the existing pasted-diff verification flow. Automatic GitHub pull request review, commits back to a repository, live web crawling, organization-wide knowledge bases, and claims of compliance are outside scope. External URLs may appear in user notes but are not verified evidence until a later source adapter captures their content and revision.

## Decisions and assumptions

- **Decision:** Capture immutable source revisions. Mutable answers and branch names cannot explain what a past artifact used.
- **Decision:** Extend the current phase graph, artifact versions, verification panel, and Quick Spec flow. These already cover part of the user journey.
- **Decision:** Give saved Quick Specs their own artifact type. The existing `spec` type means a legacy technical specification and should keep that meaning.
- **Decision:** Treat evidence links and confirmation as separate records. Source relevance can be suggested by a model; confirmation requires a user action or an explicit user constraint.
- **Resolved:** Repository scans now retain the resolved commit SHA, and repository-file evidence is pinned to that commit and path. A moving branch name alone is never treated as a stable revision.
- **Assumption:** The current project owner model remains the access boundary. Collaboration roles are outside scope.

## Deletion inventory

No production subsystem is removed in the first migration. The implementation should replace freeform source strings as the only trace for new constitution decisions, and remove any new duplicated staleness calculation once claim-level impact drives the existing phase summary. Legacy fields remain readable for old artifacts.
