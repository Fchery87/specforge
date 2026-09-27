# Magenta brand

**Date:** 2026-09-27
**Roadmap:** Phase 5, [Magenta brand](../roadmap.md)
**ADR:** [0002. Replace the Ember palette and type with the Magenta brand](../adr/0002-magenta-brand.md)

## Problem

Ember's structure works and its identity does not. The product owner reviewed it and called it dated
and not captivating: a near-black ground with one warm clay accent, in the default Inter, Source Serif
and JetBrains Mono trio, is the look most AI-built developer tools shipped in 2026. Nothing about it
says SpecForge.

The token names make the identity hard to change. Colour utilities are named for Ember's hues,
`text-ember`, `bg-sage`, `text-brick`, `text-amber`, `text-slate`, in about 380 places, so a palette
change either leaves names that lie about their colour or touches every surface.

## Goal

SpecForge renders in the Magenta brand the owner approved in `design/prototypes/brand-directions.html`
on every surface, in both themes, with every gate the Ember redesign added still passing.

Success is measurable:

1. `app/globals.css` and `design/tokens.json` hold the Magenta values, and
   `node design/audit-token-sync.mjs` proves they agree.
2. Every colour pair clears its WCAG 2.2 floor, proven by `node design/audit-contrast.mjs`.
3. No Ember hue name remains in a utility or a custom property:
   `grep -rnE "(bg|text|border|ring|fill|stroke|outline|decoration|divide)(-[lrtbxy])?-(ember|sage|brick|amber|slate)\b" app components hooks lib`
   returns nothing.
4. Inter, Source Serif 4 and JetBrains Mono are no longer loaded, and the rendered pages use Funnel
   Display, Funnel Sans and Red Hat Mono only.
5. The mark is inline SVG and follows the theme.
6. The existing test suite, typecheck, lint, whole-tree palette lint and build pass.

## Non-goals

- Changing structure. The spacing scale, the three-radius rule, border-first elevation, the focus
  treatment, the reading surface's notation and the one-description-per-page rule from ADR 0001 all
  stand. Only their values change.
- Changing behaviour. No route, Convex function, prompt or generation path changes.
- The workspace features shown in the directions prototype that need new data or new interaction: a
  next action that names blocking claims, a jump-to palette, per-project stage bars on the dashboard.
  Each is a feature with its own spec, not part of a rebrand.
- Rewriting copy, except the landing headline, which the owner approved with the direction.

## Approach

### Tokens

`design/tokens.json` is rewritten with the Magenta values under the same structural names, so
`void`, `surface`, `panel`, `raised`, `line`, `line-strong`, `field`, `dim`, `muted` and `ink` keep
their meaning and their call sites. The hue tokens become semantic: `brand`, `success`, `warning`,
`destructive`, `info`. `ember-soft` and `ember-deep` are deleted, and their two uses fall to `brand`
and `line-strong`.

### The rename

One codemod maps each hue utility to its semantic name: `ember` to `brand`, `sage` to `success`,
`brick` to `destructive`, `amber` to `warning`, `slate` to `info`. It matches only utility prefixes
(`bg-`, `text-`, `border-`, `ring-` and the rest) so the word `message` and the Tailwind default
palette are untouched. Tests are renamed by the same codemod.

### Type

`next/font/google` loads Funnel Display, Funnel Sans and Red Hat Mono. `--font-display` is added for
headings. `--font-serif` is deleted and `document-prose` sets Funnel Sans. Display and heading
tracking move into the type scale.

### Mark

`components/ui/logo.tsx` draws the section-sign tile as inline SVG and keeps its props, so call sites
do not change. `app/icon.svg` carries the same mark for the browser tab.

### Motion

The button primitive presses to 0.97. The ease-out token takes the stronger curve. Nothing moves on
hover.

## Amendment, 2026-09-27: the layout pass

The first rollout changed colour and type on the existing layouts, and the owner's review found the
product still did not look like the chosen prototype. A second pass set the prototype's composition:
the project workspace as a sheet with the stage band, a next action and a phase ledger; the dashboard
as a list of rows each carrying the band; the reading surface with the contents rail on the left and
claims stamped as hallmarks; and the phase page as two tabs.

Two items this spec listed as non-goals came with the composition because they need no new data: the
next action names a stage's untraced claims from the existing stage-quality counts, and each project
row draws the stage band from the phases it already loads. The jump-to palette stays out of scope.

Deleted by the layout pass: `components/dashboard/pinned-projects.tsx`, whose grid the pinned-first
list replaces; the dashboard's three action cards, whose actions are the header buttons; and its
stat cards, which repeated `PersonalAnalytics`.

## Deletion inventory

Deleted outright:

- `public/specforge-logo-emblem.jpg`. The mark is inline SVG.
- The `emblem` variant's `next/image` path in `components/ui/logo.tsx`.
- The `ember`, `ember-soft`, `ember-deep`, `sage`, `brick`, `amber` and `slate` custom properties and
  their `--color-*` utilities in `app/globals.css`, and the same keys in `design/tokens.json`.
- The Inter, Source Serif 4 and JetBrains Mono font loads in `app/layout.tsx`, and `--font-serif`.

Kept and reworked, not deleted:

- `design/prototypes/direction-*.html` and `design/brief.md` stay as the record of the Ember decision.
  `design/prototypes/brand-directions.html` is the record of this one.
- `lib/clerk-theme.ts` keeps its three appearance objects and reads the new token names.
- `design/audit-contrast.mjs`, `design/audit-token-sync.mjs` and `design/lint-tokens.mjs` keep their
  checks and read the new names.
