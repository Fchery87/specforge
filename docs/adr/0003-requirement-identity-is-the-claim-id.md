# 0003. A requirement's identity is its claim ID, and the requirement registry outranks the project description

**Date:** 2026-09-27
**Status:** Accepted

## Context

Until phase 7, a requirement was identified by its wording. `reconcileArtifactClaims` matched each
generated bullet to an existing claim by exact lower-cased text, so rewording `REQ-0012` retired it
and issued a new ID. Its evidence links, review state and verification results stayed on the
retired row. Change specs cannot exist under that rule: a "modified" requirement needs an identity
that survives new wording, and phase 8 checks pull requests against requirement IDs.

The phase 7 walkthrough (`docs/evaluations/2026-09-27-change-specs-walkthrough.md`) added a second
pressure. After a change moved an invitation lifetime from one day to seven, a regeneration trusted
the unchanged project description over the requirement, wrote a note that the two conflicted, and
opened that note with the requirement's ID. Generation had no rule for which source wins.

## Decision

1. A requirement is its claim row, named by its project-wide `claimId` (`REQ-0001`). Its wording
   can change; its ID cannot.
2. Reconciliation matches a generated bullet that opens with `**REQ-nnnn**` to the live claim with
   that ID in the same phase before falling back to wording. It never adopts an ID the project did
   not issue: an unknown ID falls back to wording, and a new claim gets the next issued ID.
3. Every section prompt lists the phase's live claims under their IDs and states that they are the
   current decisions: where one differs from the project description or an earlier answer, the
   requirement wins. An ID opens only the bullet that states that requirement.
4. A change edits the registry in place. A rewording patches the claim's text and keeps its row, so
   evidence and history stay with the ID; the previous wording goes to `claimRevisions`.

## Alternatives

- **Match by fuzzy text similarity.** Guesses identity, and a wrong guess silently moves evidence to
  another requirement. Lost to explicit IDs, which fail visibly as "needs review".
- **Keep text matching and record changes as retire-plus-add pairs.** Every edit would break the
  ID a pull request or ticket cites, which defeats phase 8.
- **Make the project description the source of truth and rewrite it on every change.** The
  description is the reader's prose, not a requirement list; rewriting it would overwrite their
  words, and it still would not give requirements an identity.
- **Trust any ID the model writes.** One invented or reused ID would attach a claim's evidence to
  the wrong statement. The registry issues IDs; the model only echoes them.

## Consequences

- IDs are stable across rewording, so changes, tickets, exports and pull-request checks can cite
  them.
- Correctness now depends on the model placing IDs well. The walkthrough showed it can attach an
  ID to the wrong bullet when its prompt left precedence open; the prompt rule closed that case, and
  a misplaced ID stays within its own phase and is flagged `needs_review`, but the risk is real.
- The claim registry inherits the extractor's noise. Metadata bullets ("Priority", "Trace",
  "Status") become claims with IDs, and a change can act on them. Stable IDs make that noise
  persistent rather than transient.
- The project description is no longer authoritative once requirements exist; a reader who edits
  the description expecting the spec to follow will find the requirements win.

## Revisit when

- Generated documents move to a structured format where requirements are records rather than
  markdown bullets; identity should then live in the record, not in a bold prefix.
- The walkthrough's ID retention stops holding on a new model, visible as reworded claims retired by
  a regeneration while `claimRevisions` rows exist for them.
