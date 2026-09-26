# Ember redesign

**Date:** 2026-09-26
**Plan:** [Ember redesign plan](../plans/2026-09-25-ember-redesign.md)
**ADR:** [0001. Replace the brutalist design system with Ember](../adr/0001-ember-design-system.md)

## Problem

SpecForge's purpose is to produce a long technical document, and its interface has no surface for
reading one.

- The generated artifact is rendered as a card containing markdown, or opened in a full-screen modal
  with a textarea. Neither gives a reader a table of contents, section anchors, a place to record
  what was verified, or a way to compare a revision against the one before it. `artifact-preview.tsx`
  lists sections as cards; `artifact-editor-modal.tsx` offers Edit, Split, Preview and Schema as
  full-screen modes. A user reviewing a 4,000-word PRD scrolls.
- Eight phases are visible at once. The project page renders `StageCard`, `StageStepper`, `StageTabs`
  and `PhaseStepper` against the same list, so the workflow is described in four places and none of
  them answers "what do I do next" faster than the others.
- Requirement text carries no identity at the point of reading. Claim IDs exist in the data
  (`lib/evidence.ts`, `convex/evidence.ts`) and appear in a separate review panel, so a reader
  cannot tell from a clause whether it is confirmed, proposed, or untraced.
- The visual system works against reading. A global rule forces `h1` through `h4` and every `button`
  to uppercase with `tracking-tighter`, which costs word-shape information in the dense text the
  product is made of. Every radius is zero, every border is 2px, and headings and buttons animate
  scale on hover, so interactive elements move under the pointer.
- The palette fails accessibility in the places it is used. `--muted-foreground` measures 3.15:1
  against the page ground, below the 4.5:1 floor for body text. The token appears in every
  descriptor, label, and caption in the product.
- Design tokens exist in three places and disagree. `app/globals.css` declares the palette twice, once
  as Tailwind v4 `@theme` hex values and once as `:root` HSL values. `lib/clerk-theme.ts` declares it a
  third time. The light theme is unreachable: `@custom-variant dark` is declared and no `.dark` block
  exists, so the app is dark-only despite `next-themes` being installed.
- Clerk is themed twice, from `lib/clerk-theme.ts` and from roughly 150 lines of `.cl-*` rules in
  `app/globals.css` that target hashed internal class names such as `.cl-internal-b3fm6y` with
  `!important`. The two disagree about border width and colour.
- The landing page's loudest elements are a marquee, a scrolling tech-stack banner, a noise overlay,
  and a grid background. None of them shows the product.

## Goal

A user reads, reviews, and signs off on a specification inside SpecForge, and the interface is
designed for that hour of reading.

Success is measurable:

1. A specification renders as a document with numbered sections, a table of contents, working
   anchors, and per-clause status. Deep-linking to a clause scrolls to that clause and leaves the
   sticky header clear of it.
2. Every clause shows its claim ID and its evidence state in a margin column, and a clause with no
   evidence is visibly marked rather than silently passing.
3. Every text and non-text colour pair the interface renders clears its WCAG 2.2 threshold, proven by
   `node design/audit-contrast.mjs` exiting zero.
4. The palette and the retired patterns are enforced by a lint that fails on a violation.
5. Light and dark both render, both pass, and both come from one token source.
6. The existing test suite passes, and every test updated for the redesign is updated because the
   interface changed on purpose, not to make an assertion stop failing.

## Non-goals

- Changing what the product does. No route is added or removed, no Convex query or mutation changes
  shape, no prompt changes, and no generation behaviour changes.
- Renaming anything a user sees. The stage names, phase names, mode names and status words in
  `docs/specs/2026-09-25-guided-workflow.md` stay exactly as that spec defines them.
- The reading surface's own features that need data the schema does not have: comments, threaded
  review, approval signatures, and per-user read state are out of scope. The margin marks state that
  already exists.
- Merging the eight phase definitions. `lib/workflow.ts` stays the owner of the workflow, and this
  spec changes how its state is presented, not how it is modelled.
- A marketing rewrite. Copy changes only where the current copy describes a design that no longer
  exists.
- Mobile-native behaviour beyond a responsive web layout. The existing breakpoints stay.

## Approach

### One token source

`design/tokens.json` holds the palette for both themes. It is the source of record, audited by
`design/audit-contrast.mjs` and linted by `design/lint-tokens.mjs`. `app/globals.css` gets one
Tailwind v4 `@theme` block generated from it. The `:root` HSL duplicate is deleted, and
`lib/clerk-theme.ts` reads the same values.

Dark is the primary theme, taken from the Apex Code Ember palette: a warm accent on a near-black
ground with four distinct greys. Light is a neutral ground, not a warm one, with a separately chosen
accent because the dark accent measures 3.32:1 on white.

The accent is functional. It marks the active phase, the focused element, a link, the primary
action, and a claim under review. It never appears as a gradient, a glow, or a background wash.

### Structural standards

Spacing on a 4px scale. Radius limited to three values. Elevation from 1px hairlines, with shadows
reserved for popovers, menus and modals. Motion limited to five durations with exits running at half
the entrance duration. Focus always visible at 2px with a 2px offset. Reduced motion collapses
durations to zero at the token level, so every component inherits the decision.

### The reading surface

The artifact view becomes a document. Concretely:

- A numbered section list derived from the artifact's headings, rendered as a table of contents with
  a scroll-spy driven by `IntersectionObserver`, which highlights the topmost visible heading and
  honours reduced motion before smooth scrolling.
- Every heading gets an anchor and a stable id, so a clause can be linked and cited.
- A margin column carries the claim ID and the evidence state for each clause.
- Status is a word, not a colour alone.
- The prose column is capped below 80 characters per line.

The notation for the margin column is settled by the direction decision recorded in
`design/decisions.tsv`, and the built reference is in `design/prototypes/`.

### Primitives

`components/ui/` is replaced with shadcn/ui primitives themed by the Ember tokens, because the
existing set is a partial hand-rolled equivalent. Its `sheet.tsx` re-exports `dialog.tsx`, and its
`accordion.tsx`, `popover.tsx` and `tabs.tsx` re-export Radix with no styling at all, so callers
style them ad hoc. The shadcn source brings correct focus, composition and accessibility semantics,
and a maintained update path.

The migration is one wave. The acid-yellow tokens are deleted rather than kept alongside the new
ones, because a product rendering two palettes is worse than either one alone.

### Verification

The redesign ships with the gates that keep it from eroding, since the repository has no visual
regression baselines today:

- `design/shot.mjs` and `design/routes.json` capture the public routes at two viewports in both
  themes. `design/screens/baseline/` holds the pre-change state for comparison.
- `design/audit-contrast.mjs` fails on any colour pair below its threshold.
- `design/lint-tokens.mjs` fails on an off-palette colour or a retired pattern.
- `design/audit-page.mjs` measures a live page: font families against the three-role ceiling, distinct
  type sizes, distinct radii against the three-value ceiling, off-palette colours in computed styles,
  contrast failures on real text nodes, characters per line in prose, and resting shadows.

## Deletion inventory

Deleted outright:

- `components/ui/noise-overlay.tsx` and its use in `app/layout.tsx`. A grain overlay is a retired
  pattern and it sits above every surface.
- `components/ui/decorative-text.tsx` and its ten call sites. A giant muted watermark behind page
  content is decoration that encodes nothing, and its test asserts on a `clamp()` literal.
- `components/ui/marquee.tsx` and the two marquee bands on the landing page. A scrolling banner is not
  a way to explain a specification tool, and `react-fast-marquee` goes with it.
- `components/ui/logo.tsx`'s glow, and the `drop-shadow` on the monogram. Glow is retired.
- The `.bg-grid`, `.bg-grid-fade` and `.bg-grid-auth` utilities and every call site, including the
  inline `backgroundImage` grids duplicated in `app/error.tsx`, `app/not-found.tsx`,
  `app/project/[id]/error.tsx` and `app/project/[id]/not-found.tsx`.
- The `:root` HSL token block in `app/globals.css` and the `hsl(var(--success))` style of reference
  that depends on it.
- The `h1, h2, h3, h4, button { @apply uppercase tracking-tighter font-bold }` rule.
- The `.cl-*` `!important` overrides in `app/globals.css`, replaced by Clerk's supported appearance
  API.
- The `hover:scale-105` and `active:scale-95` transform on primary buttons, and the
  `hover:-translate-y-1` lift on cards. Interactive elements do not move under the pointer.
- `--text-v-hero`, `--text-v-h2` and `--text-v-h3`, replaced by the role-based type scale.
- All zero-radius tokens, replaced by the three-value scale.
- `public/specforge-logo-emblem.jpg`, `public/specforge-logo-isometric.jpg` and
  `public/specforge-logo-monogram.jpg` if the new mark does not use them.
- The `Research/Direction prototypes` note in `design/brief.md` that describes the three directions,
  once the direction is chosen and recorded.

Kept and reworked, not deleted:

- `components/ui/confirm-dialog.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `select.tsx`,
  `scroll-area.tsx`, `skeleton.tsx`, `switch.tsx`, `checkbox.tsx`, `progress.tsx`, `label.tsx`,
  `input.tsx`, `textarea.tsx` and `badge.tsx` are replaced by their shadcn equivalents with the same
  export names, so call sites keep working.
- `components/ui/mermaid-diagram.tsx` and `mermaid-aware-content.tsx` keep their behaviour and get
  the Ember theme values.
- `lib/clerk-theme.ts` keeps its three appearance objects and takes its values from the tokens.
- `ARCHITECTURAL_PLAN.md` keeps its content. Only its claim about the visual identity is superseded,
  and ADR 0001 records that.
- `design/` is retained as the redesign's working record: the brief, the token source, the four
  scripts, the prototypes, the screenshots and the decision trail.
