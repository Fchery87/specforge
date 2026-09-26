# 0001. Replace the brutalist design system with Ember

**Date:** 2026-09-26
**Status:** Accepted
**Supersedes:** the brutalist identity defined in `ARCHITECTURAL_PLAN.md` and the acid-yellow token set in `app/globals.css`

## Context

SpecForge has shipped one visual identity since its first release. It is brutalist: acid yellow
`#dfe104` on near-black `#09090b`, every corner square, 2px borders, headings and buttons forced to
uppercase by a global rule, a noise overlay, a grid background, glow shadows, and a marquee. The
identity is deliberate and `ARCHITECTURAL_PLAN.md` named preserving it as a goal.

Four things changed.

The product's core object is a long technical document. The interface treats a specification as a
card or a code block. There is no reading surface: no table of contents, no section anchors, no
margin for claim IDs and evidence, no place to annotate a clause. The most important thing the
product makes is the thing the interface is worst at showing.

The conventions around it moved. The developer tools that set the standard for this category in 2026,
Linear, Vercel, Resend, Mintlify, all converge on the same structural language: near-black grounds,
1px hairlines instead of shadows for elevation, one functional accent, a narrow radius scale, a
role-based type scale, and motion measured in five durations. Zero-radius everything and forced
uppercase read as a 2021 style now, and forced uppercase costs legibility in the dense text this
product is made of.

The category has an opening. Every competitor, GitHub Spec Kit, Amazon Kiro, Tessl, OpenSpec, BMAD,
ships markdown files in an IDE or a chat box. The most cited complaint from people who use them is
that the specifications are tedious to review. Nobody has built the review surface.

The current system also breaks accessibility rules. Its dim grey measures 3.15:1 against the ground,
below the 4.5:1 floor for body text. Its Clerk overrides and its palette exist in three places, and
its tokens are duplicated as both `@theme` hex values and `:root` HSL values.

## Decision

Replace the visual system rather than extend it. Keep the product structure, the route map, the
component boundaries, and the copy. Change how it looks, how it is tokenised, and what it optimises
for.

**Palette.** Adopt the Ember palette. Warm accent `#c87a46` on a near-black ground `#09090a`, with
four distinct greys, a decorative hairline tier, a perceivable control-boundary tier, and four muted
semantic hues. The accent is functional only: active phase, links, focus ring, primary action. It
never appears as a gradient, a glow, or a decoration.

**Ownership.** One token file, `design/tokens.json`, is the source of record. It generates the
Tailwind v4 `@theme` block in `app/globals.css`. The duplicated `:root` HSL block is deleted. Clerk's
appearance is derived from the same tokens.

**Structural standards.** Spacing on a 4px scale. Radius limited to three values, 6px for controls,
12px for containers, full for pills. Elevation from 1px hairlines; shadows only on popovers, menus
and modals. Motion limited to five durations, 0, 100, 200, 400, 600ms, entering with ease-out and
exiting with ease-in at half the entrance duration. Focus always visible, 2px outline with 2px
offset, in both themes. Reduced motion collapses durations to zero at the token level.

**Components.** Adopt shadcn/ui as the primitive layer. The repository already contains a partial,
hand-rolled equivalent. The new primitives are the shadcn source, themed with Ember tokens, so that
accessibility behaviour and composition patterns come from a maintained source rather than from
local invention.

**The reading surface.** The generated specification becomes the centre of the interface: a rendered
document with numbered sections, anchors, a table of contents, claim IDs and evidence in the margin,
and a change view against a previous revision. This is the product's differentiator and the design
spends its budget there.

**Light mode is a real theme.** The current build has a `dark` variant declared and no `.dark` block,
so the app is dark-only in practice. Ember ships both themes, with a separately chosen light accent
because the dark accent measures 3.32:1 on white.

**One description per page.** The project page and the phase page each described the same eight
phases three or four times over: stage cards, a stepper, sub-tabs, breadcrumbs and a next action. Ember
collapses that to one stepper and one next action per page, with a single control for re-enabling a
skipped phase. The workflow data itself is unchanged, and `lib/workflow.ts` stays the owner of it.
This supersedes the page composition described in the [guided three-stage workflow
spec](../specs/2026-09-25-guided-workflow.md); the stage grouping, mode policies and naming from that
spec still stand.

## Consequences

The repository's own documented conventions change. `components/AGENTS.md` states that the design
system uses sharp corners; that line is now wrong and is updated by this change. The new convention
is a three-value radius scale.

Tests that assert on class names and on forced uppercase break and are updated deliberately. The
inventory in the redesign spec lists each one.

`ARCHITECTURAL_PLAN.md` becomes historical on the question of visual identity. Its other content is
unaffected.

Every surface has to be migrated in one wave. A half-migrated product with two palettes is worse than
either palette alone, so the old acid-yellow tokens are deleted rather than left available.

Adopting shadcn/ui adds a dependency on its registry and its update path. The trade is a maintained
primitive layer with correct focus, composition and accessibility semantics, against local
maintenance of the same thing.

The verification story has to change with it. Visual regression baselines do not exist in this
repository, so the redesign adds a screenshot harness, a palette and pattern linter, and a WCAG
contrast audit that fails the build. These are the gates that keep the new system from eroding.

The migration ran over every surface, six months of feature work that had drifted onto the Tailwind
default scale and the raw palette. The palette lint found 835 off-scale utilities, 205 uppercase
labels and ten emoji, and the whole-tree lint now runs in CI over `app/`, `components/`, `hooks/` and
`lib/` rather than a hand-maintained file list. A second audit, `design/audit-token-sync.mjs`, keeps
the hand-mirrored `@theme` block honest against `design/tokens.json`.

## Alternatives considered

**Keep the brutalist identity and refine it.** Rejected. The identity is coherent, but its two load
bearing traits, forced uppercase and zero radius, work against the dense reading surface the product
needs, and the acid yellow fails contrast in the places it is used as text.

**Rebrand the palette only.** Rejected. The measured problems are structural, not chromatic: one
component vocabulary that cannot render a document, tokens in three places, and no theme support.

**Build the primitives locally rather than adopting shadcn.** Rejected. The repository already shows
where that leads: a hand-rolled set with inconsistent variants, a `sheet.tsx` that re-exports
`dialog.tsx`, and an accordion and popover re-export that provide no styling at all.

**Ship dark only.** Rejected. Light mode is a genuine requirement for a document product that people
read for an hour at a time, and the missing `.dark` block is a latent bug rather than a decision.
