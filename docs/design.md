# Design system

Ember. A warm accent on a near-black ground, with a document surface at the centre of the product.

This is the working guide for anyone changing the interface. The decision that replaced the previous
brutalist system is recorded in [ADR 0001](adr/0001-ember-design-system.md), and the scope of the
change is in the [Ember redesign spec](specs/2026-09-25-ember-redesign.md).

## Where the values live

`design/tokens.json` is the source of record. It holds both themes. `app/globals.css` mirrors it in
one Tailwind v4 `@theme inline` block, which generates the utilities the components use.

The mirror is written by hand, so `node design/audit-token-sync.mjs` compares the two files and
fails on any disagreement. Run it after changing a value in either place.

Never write a raw colour in a component. Use a token utility.

## Palette

Dark is the primary theme. Light is a neutral ground, not a warm one, and its accent is a different
value because the dark accent measures 3.32:1 on white.

| Token | Dark | Light | Role | Contrast floor |
| --- | --- | --- | --- | --- |
| `void` | `#09090a` | `#fcfcfd` | page ground | |
| `surface` | `#111113` | `#ffffff` | panels, cards | |
| `panel` | `#17171a` | `#ffffff` | overlays, menus | |
| `raised` | `#202024` | `#f4f4f5` | selected rows, hover | |
| `line` | `#26262b` | `#e4e4e7` | decorative hairline | visible at all |
| `line-strong` | `#3a3a44` | `#c9c9d0` | grouped divider | visible at all |
| `field` | `#6a6a74` | `#8b8b93` | control boundary | 3:1 |
| `dim` | `#85858f` | `#71717a` | labels, keybindings | 4.5:1 |
| `muted` | `#a1a1ab` | `#52525b` | values, descriptors | 4.5:1 |
| `text` | `#e9e9ec` | `#18181b` | content | 4.5:1 |
| `ember` | `#c87a46` | `#a05526` | accent, active, focus | 4.5:1 as text, 3:1 as a ring |
| `ember-soft` | `#e0a479` | `#8c4a21` | headings, inline code | 4.5:1 |
| `ember-deep` | `#7d4726` | `#dbbfa8` | track fill | no text use |
| `sage` | `#7fa37a` | `#3f6b45` | confirmed, additions | 4.5:1 |
| `brick` | `#c97070` | `#a33b3b` | failed, deletions | 4.5:1 |
| `amber` | `#c6a052` | `#8a6414` | needs review, warning | 4.5:1 |
| `slate` | `#6f92a6` | `#39637d` | metadata, keywords | 4.5:1 |

The accent is functional. It marks the active phase, the focused element, a link, the primary
action, and a clause under review. It never appears as a gradient, a glow, or a background wash.

```bash
node design/audit-contrast.mjs   # every pair above against its floor, exits non-zero on a failure
```

## Type

Three roles, no fourth face.

| Role | Family | Where |
| --- | --- | --- |
| Chrome | Inter (`font-sans`) | navigation, controls, labels, tables |
| Document | Source Serif 4 (`font-serif`) | rendered specification prose |
| Identifiers | JetBrains Mono (`font-mono`) | claim IDs, clause numbers, hashes, code, counts |

Scale, one ratio of 1.25 anchored at 16px with an interpolation step at 17px:

| Token | Size / line height | Use |
| --- | --- | --- |
| `text-caption` | 12 / 16 | metadata, claim IDs, counts |
| `text-label` | 13 / 20 | navigation, controls, form labels |
| `text-ui` | 14 / 20 | tables, dense body |
| `text-body` | 16 / 24 | default body |
| `text-prose` | 17 / 28 | specification prose |
| `text-title` | 20 / 28 | clause titles, section headings |
| `text-heading` | 32 / 40 | page headings |
| `text-display` | 56 / 60 | one per page, at most |

Rules. Display sizes take negative tracking, never positive. Prose sits under 80 characters per
line, capped by `--measure` at 68ch. Numbers that align in a column use tabular numerals. Headings
are sentence case, never uppercased, and never animate.

## Space, radius, elevation

Spacing is a 4px scale. No off-scale values.

Radius has exactly three values: `rounded-sm` (6px) for controls, `rounded-lg` (12px) for containers
and overlays, `rounded-full` for pills. Nothing else.

Elevation comes from a 1px hairline, not from a shadow. A resting element has no shadow. Only
popovers, menus, and modals get one.

## Motion

Five durations: 0, 100ms (`--duration-quick`), 200ms (`--duration-standard`), 400ms
(`--duration-considered`), 600ms (`--duration-cinematic`). Three easings: `--ease-quiet-out` for
entrances, `--ease-quiet-in` for exits, `--ease-quiet-both` for a change that stays.

An entrance eases out. An exit eases in and runs at half the entrance duration. Hover, focus, and
press states are instant. Never animate a layout property on hover: nothing moves or scales under
the pointer.

Reduced motion collapses every duration to zero at the token level, so components inherit the
decision rather than each re-implementing it.

## Focus

One treatment, applied globally to `:focus-visible`: a 2px outline in `--ring` with a 2px offset.
Never remove it. Do not add a second ring with `ring-*` utilities. `scroll-padding-top` keeps a
focused element clear of the fixed header.

## The document language

A specification is a document, not a card. `components/spec-document.tsx` holds the notation and
`components/artifact-document.tsx` renders a real artifact with it. The artifact view
(`components/artifact-preview.tsx`), the development preview at `/design`, and the landing-page hero
all render through one of the two, so the reader meets one notation everywhere.

- The margin column carries the clause number and the claim ID, in mono with tabular numerals. It is
  64px wide on desktop and collapses inline below `md`.
- A clause body hangs off a 1px spine. The spine connects the clause to its evidence.
- A claim with no evidence keeps its spine and turns amber. Gaps are drawn, not left invisible.
- Status is a word, not a colour alone and not a pill.
- One notation carries two kinds of trace: evidence for a claim, and a blocking edge between tracer
  bullets. Readers learn it once.
- The table of contents doubles as a gap map. A clause whose claims are unsettled says so, with a
  count and a state word.
- A mermaid fence stays a diagram. `ArtifactDocument` splits the body at fences and advances the
  heading cursor by `countSpecHeadings`, so the anchors stay aligned with the outline.

## One description per page

The workflow is described once per page. `components/stage-stepper.tsx` is the map,
`components/next-action-button.tsx` is the instruction, and `components/add-section-menu.tsx` is the
one control that brings a skipped phase back. `StageCard` and `StageTabs` are retained but no longer
rendered by a page. Do not add a fourth description of the same eight phases.

## Components

`components/ui/` holds the primitives. The set is themed with Ember tokens and keeps the export
names and variant names the rest of the app already imports. New components come from the shadcn
registry and are themed the same way. `components.json` records the configuration.

Prefer an existing primitive over new markup. Use `cn()` for conditional classes. Use `gap-*` rather
than `space-y-*`, and `size-*` when width and height match.

## Checks

| Command | What it proves |
| --- | --- |
| `node design/audit-contrast.mjs` | every colour pair clears its WCAG 2.2 floor |
| `node design/audit-token-sync.mjs` | the stylesheet still matches `design/tokens.json` |
| `node design/lint-tokens.mjs <files>` | no off-palette colour, no off-scale type, radius or tracking utility, no retired pattern (glow, glass, noise, gradient decoration, arrow glyphs on links, emoji). Warnings, not errors, for `uppercase`, which occasionally needs a human call |
| `node design/audit-page.mjs <url>` | a live page: font families against the three-role ceiling, distinct type sizes, distinct radii, off-palette colours in computed styles, real contrast failures, characters per line, resting shadows, the computed focus ring, and header overlap |
| `node design/inspect-type.mjs <url>` | a live page's leftover uppercase and weights above 700, with the class string, which is how a half-migrated component is found |
| `node design/shot.mjs --label <name>` | screenshots from `design/routes.json` |

Every surface is migrated, so the palette lint runs over the whole tree in CI:

```bash
mapfile -t files < <(find app components hooks lib -name '*.tsx' -o -name '*.ts')
node design/lint-tokens.mjs "${files[@]}"
```

The last column of [`design/decisions.tsv`](../design/decisions.tsv) records the evidence each step
produced. The post-migration screenshots are in `design/screens/step-11/`.

## Retired patterns

Linted rather than merely discouraged: glow shadows, text shadows, glass and `backdrop-filter` on
content, noise and grain overlays, gradient decoration, arrow glyphs in link text, emoji, and the
off-scale type, radius and tracking utilities. `uppercase` and font weight above 700 are reported by
`inspect-type.mjs` against a rendered page, because both need the computed style rather than a
source match.
