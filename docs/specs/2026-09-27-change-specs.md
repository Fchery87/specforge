# Change and bug-fix specs

**Date:** 2026-09-27
**Roadmap:** Phase 7, [Change and bug-fix specs](../roadmap.md)

## Problem

SpecForge specifies a product once. After the first generation there is no way to say "change
this", only "regenerate this", and regeneration cannot express a change:

1. **A requirement has no identity beyond its wording.** `reconcileArtifactClaims` in
   `convex/lib/evidence.ts` matches claims by exact lower-cased text. Reword `REQ-0012` and the next
   generation retires it and issues `REQ-0031` for the new wording. Evidence links, review state
   and verification results stay on the retired ID. A "modified" requirement cannot exist today.
2. **A change has no record.** Rewriting the PRD to add a feature leaves no trace of what was
   added, what was changed and why. Nothing tells a coding agent "these three requirements changed;
   build only this".
3. **A bug has nowhere to go.** A reported defect either means the implementation breaks a
   requirement that is right, or the requirement itself is wrong. Neither can be written down
   against the spec, so the regression it needs is never specified.

Phase 8 (pull-request verification) checks a pull request against requirement IDs. It needs IDs
that survive edits and a record of which requirements a change touched, so this phase comes first.

## Goal

A reader can open a project with a generated spec, describe a feature change or a bug, and get a
**change spec**: a reviewed list of requirements added, modified and removed against the current
spec, each with a reason and evidence. Applying it updates the project's requirements in place,
with IDs preserved for modified requirements, and the change stays on record and in the export.

## Non-goals

- **Specifying an existing codebase that has no SpecForge spec.** A change is written against a
  project's current requirements. Reverse-engineering a baseline from code is a separate phase.
- **Rewriting the phase documents on apply.** Applying a change updates the requirement registry.
  The documents are marked out of date and regenerated when the reader asks, as today.
- **Pull-request verification.** Phase 8 consumes the change record; this phase does not check code.
- **Branching or merging changes.** Changes apply one at a time against the latest requirements. A
  change drafted against requirements that moved since must be refreshed, not merged.
- **Changing the eight-phase workflow.** A change is not a ninth phase and does not appear in the
  sidebar's phase list.

## Approach

### Data shape

The requirement registry is the existing `claims` table: one row per requirement, with a
project-wide `claimId` (`REQ-0001`), the phase that owns it, and `retiredAt` for removal. This
phase adds two tables and one field.

```ts
// A change spec: one feature change or one bug fix against a project's requirements.
changes: {
  projectId: Id<'projects'>;
  changeNumber: number;              // CHG-0001, from a per-project counter like nextClaimNumber
  kind: 'feature' | 'bugfix';
  title: string;
  summary: string;                   // what and why, in the reader's words
  bug?: {                            // bugfix only
    observed: string;
    expected: string;
    reproduction: string;
  };
  status: 'draft' | 'applied' | 'abandoned';
  createdAt: number;
  appliedAt?: number;
}

// One operation in a change. A discriminated union, so an "add" cannot name a target and a
// "remove" cannot carry new text.
changeOps: {
  changeId: Id<'changes'>;
  order: number;
  reason: string;
  evidenceSourceIds: Id<'evidenceSources'>[];
  op:
    | { type: 'add'; phaseId: string; kind: ClaimKind; text: string }
    | { type: 'modify'; claim: Id<'claims'>; baseText: string; text: string }
    | { type: 'remove'; claim: Id<'claims'>; baseText: string }
    | { type: 'reaffirm'; claim: Id<'claims'>; baseText: string };  // bugfix: spec is right
}

// claims gains a history, so a modified requirement keeps its ID and its past wording.
claimRevisions: { claim: Id<'claims'>; text: string; changeId?: Id<'changes'>; createdAt: number }
```

`baseText` is the claim's wording when the op was drafted. It is the conflict check: a change
applies only if every targeted claim still reads its `baseText`. `reaffirm` records that a bug
breaks a requirement that is correct, so the change adds a regression criterion without editing
the requirement.

### Identity: reconcile by ID first

`reconcileArtifactClaims` learns to read the claim ID a generated item carries (`**REQ-0012**` at
the start of the bullet, the form `formatClaimManifest` already writes) and to match on it before
falling back to text. Generation prompts receive the live claims with their IDs and are told to
keep an ID on a requirement they reword. Without this, the first regeneration after an applied
change would undo it.

### Flow

1. **Start.** From the project page, "New change" opens a form: feature or bug, a title and a
   description. A bug also asks for observed behaviour, expected behaviour and reproduction steps.
   Starting a change requires at least one live requirement. A project with none is told to
   generate its requirements first.
2. **Draft.** An action drafts the ops from the description, the live claims with their IDs, and
   the repository evidence when a repository is connected. The model's output is parsed at the
   boundary: every `modify`, `remove` and `reaffirm` must name a live claim of this project, and
   an op that does not is dropped with a note, never guessed at. A bug fix always gets at least one
   added acceptance criterion: the regression test.
3. **Review.** The change page shows the ops as a diff against the current wording: added lines,
   struck-and-replaced wording for a modification, struck lines for a removal. The reader edits,
   deletes or adds ops, and each op keeps its reason and evidence.
4. **Apply.** One mutation checks every `baseText`, then applies all ops in one transaction:
   insert claims for `add` with new IDs, write a `claimRevisions` row and patch the text for
   `modify`, set `retiredAt` for `remove`. Evidence links move with the claim, because the claim row
   is the same row. The documents of every phase whose requirements were added, reworded or removed
   are marked out of date (a `reaffirm` changes no wording, so its phase stays current), through
   the existing `isStale`, `staleReason` and `staleSince` fields on `phases`, which the dashboard
   already reads. If any
   `baseText` no longer matches, nothing applies and the page offers to refresh the draft.
5. **Record.** An applied change is read-only. The project page lists changes, newest first, and
   the export pack includes each applied change as `changes/CHG-0001-<slug>.md`, so a coding agent
   gets the delta alongside the full spec.

### Where it appears

- A "Changes" section on the project page, under the phase ledger, with "New change".
- A change page at `/project/[id]/change/[changeId]`, using the project sidebar.
- On a phase page, a line when changes have been applied since the document was generated, with
  the regenerate control.

## Alternatives considered

- **Edit the PRD and diff the documents.** No stable identity survives a text diff of generated
  prose, which is the problem this phase exists to fix. Rejected.
- **Make a change a new phase in the workflow.** A project has many changes over its life; a phase
  happens once. Rejected.
- **Store ops as a markdown delta block and parse it on apply.** A readable export format, but
  parsing on apply puts the boundary in the wrong place. Ops are rows; markdown is rendered from
  them for the export. Rejected.
- **Match claims by fuzzy text similarity instead of IDs.** Guesses identity, and a wrong guess
  silently moves evidence to the wrong requirement. Rejected.

## Deletion inventory

Nothing is deleted when this phase starts. One thing becomes a candidate and one is decided:

- **Text-only claim matching** in `convex/lib/evidence.ts`. It stays as the fallback for items
  that carry no ID, and is removed once every generation prompt writes IDs back, if the tests show
  no ID-less items remain.
- **Saving a Quick spec into a project** is deleted once changes ship. The owner decided on
  2026-09-27: "Save to an existing project" becomes "Start a change from this", saved quick specs
  migrate into draft changes, and `saveQuickSpec`, `saveQuickSpecHandler`, the `phaseId: 'quick'`
  artifact slot, `app/project/[id]/quick/` and the project page's "Saved quick specs" link are
  removed. `createProjectFromQuickSpec` stays, because a new project has no requirements for a
  change to act on; it records the quick spec as a `user_note` evidence source through
  `captureEvidenceSource` instead of the removed slot, so the project's generation can cite it.

## Verification

- `convex/__tests__/changes.test.ts` covers apply against the fake context used by
  `quick-spec-save.test.ts`:
  - an `add` issues the next `REQ-` ID;
  - a `modify` keeps the claim ID, patches the text, keeps its evidence links and writes a
    `claimRevisions` row;
  - a `remove` sets `retiredAt`;
  - a stale `baseText` applies nothing and reports which op conflicted.
- `lib/__tests__` covers the draft parser: an op naming an unknown or retired claim is dropped,
  and a bug fix without an added acceptance criterion is rejected.
- `convex/__tests__/evidence.test.ts` gains the identity case: reconcile a reworded item that
  carries `**REQ-0012**`, and `REQ-0012` survives with the new text instead of being retired.
- The export test finds `changes/CHG-0001-<slug>.md` in the pack for an applied change.
- In the browser, on a project with generated requirements:
  - draft a bug fix, apply it, and see the regression criterion in the ledger's counts;
  - see the PRD phase page report the document as out of date;
  - regenerate the PRD and see the modified requirement keep its ID.
- The repository gates in `.keel/config.md` exit zero.

## Risks

- **Noisy baseline.** `extractClaimCandidates` turns any bullet with a modal verb into a claim, so
  the registry holds some lines that are not requirements. Ops drafted against noise are noise.
  Early signal: drafts that modify or remove lines a reader would not call requirements. Mitigation
  in scope: the review step lets the reader delete any op.
- **The model invents IDs.** The boundary parser drops any op whose claim is not live in the
  project; tests pin that. Early signal: dropped-op notes on most drafts.
- **Regeneration still loses an ID** when the model omits it on a reworded line. Early signal: a
  modified claim retired by a later regeneration. The identity test covers the prompt contract.
  Production drift shows as retired claims that have `claimRevisions` rows.
- **Out-of-date marking is ignored**, so documents and registry disagree. The export renders the
  manifest from the registry, so what a coding agent receives is the registry either way.
