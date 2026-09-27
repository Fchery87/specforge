# Design system

Magenta. Neutral grounds, a clean off-white and a true dark black, with one magenta accent and a
document surface at the centre of the product.

This is the working guide for anyone changing the interface. The structural system, the tokens in one
place, the document language and the gates, is recorded in [ADR 0001](adr/0001-ember-design-system.md).
The palette and type are recorded in [ADR 0002](adr/0002-magenta-brand.md), which replaced Ember's, and
the scope of that change is in the [Magenta brand spec](specs/2026-09-27-magenta-brand.md).

## Where the values live

`design/tokens.json` is the source of record. It holds both themes. `app/globals.css` mirrors it in
one Tailwind v4 `@theme inline` block, which generates the utilities the components use.

The mirror is written by hand, so `node design/audit-token-sync.mjs` compares the two files and
fails on any disagreement. Run it after changing a value in either place.

Never write a raw colour in a component. Use a token utility.

## Palette

Both grounds are neutral greys with no hue, so the accent is the only colour on screen that is not a
state. Light and dark are both first-class, and the product defaults to dark.

| Token | Dark | Light | Role | Contrast floor |
| --- | --- | --- | --- | --- |
| `void` | `#0a0a0a` | `#f7f7f7` | page ground | |
| `surface` | `#111111` | `#ffffff` | panels, documents | |
| `panel` | `#161616` | `#ffffff` | overlays, menus | |
| `raised` | `#1f1f1f` | `#efefef` | selected rows, hover | |
| `line` | `#262626` | `#e0e0e0` | decorative hairline | visible at all |
| `line-strong` | `#333333` | `#cbcbcb` | grouped divider | visible at all |
| `field` | `#6b6b6b` | `#878787` | control boundary | 3:1 |
| `dim` | `#8c8c8c` | `#666666` | labels, keybindings | 4.5:1 |
| `muted` | `#b4b4b4` | `#4a4a4a` | values, descriptors | 4.5:1 |
| `ink` | `#f2f2f2` | `#0a0a0a` | content | 4.5:1 |
| `brand` | `#ff3d9a` | `#d10f6f` | primary action, focus, link, current position | 4.5:1 as text and under its label, 3:1 as a ring |
| `success` | `#5cc98a` | `#1f7a3f` | confirmed, additions | 4.5:1 |
| `warning` | `#e7b54a` | `#8f6000` | needs review, proposed | 4.5:1 |
| `destructive` | `#ff7a6b` | `#c4291c` | untraced, failed, deletions | 4.5:1 |
| `info` | `#86a6ff` | `#3558b8` | metadata, keywords | 4.5:1 |

Hue tokens are named for what they mean, never for their hue, so a future palette change does not
leave names that lie.

The accent is functional. It marks the primary action, the focused element, a link, and where the
reader is in the workflow. It never appears as a gradient, a glow, or a background wash.

```bash
node design/audit-contrast.mjs   # every pair above against its floor, exits non-zero on a failure
```

## Type

Three roles, no fourth face.

| Role | Family | Where |
| --- | --- | --- |
| Display | Funnel Display (`font-display`) | headings, the landing headline, the wordmark |
| Interface and prose | Funnel Sans (`font-sans`) | navigation, controls, tables, rendered specification prose |
| Identifiers | Red Hat Mono (`font-mono`) | claim IDs, clause numbers, hashes, code, counts |

`h1` to `h6` take Funnel Display from the base styles. Do not set `font-sans` on a heading.

Scale, one ratio of 1.25 anchored at 16px with an interpolation step at 17px. Tracking belongs to the
scale, so no call site sets it.

| Token | Size / line height | Tracking | Use |
| --- | --- | --- | --- |
| `text-caption` | 12 / 16 | | metadata, claim IDs, counts |
| `text-label` | 13 / 20 | | navigation, controls, form labels |
| `text-ui` | 14 / 20 | | tables, dense body |
| `text-body` | 16 / 24 | | default body |
| `text-prose` | 17 / 28 | | specification prose |
| `text-title` | 20 / 28 | -1.5% | clause titles, section headings |
| `text-heading` | 32 / 36 | -3% | page headings |
| `text-display` | 44 to 104, fluid / 0.94 | -4% | one per page, the landing headline |

Rules. Display sizes take negative tracking, never positive. Prose sits under 80 characters per
line: `--measure` caps document prose at 68ch, and a 16px body block is capped at `max-w-xl`. Funnel
Sans is narrower than its `0`, so a `ch` cap allows more characters than it suggests; check a long
block with `design/audit-page.mjs`. Numbers that align in a column use tabular numerals. Headings are
sentence case, never uppercased, and never animate.

## Space, radius, elevation

Spacing is a 4px scale. No off-scale values.

Radius has exactly three values: `rounded-sm` (10px) for controls, `rounded-lg` (16px) for containers
and overlays, `rounded-full` for pills. Nothing else. Inline code in document prose rounds relative to
its text so it stays a chip.

Elevation comes from a 1px hairline, not from a shadow. A resting element has no shadow. Only
popovers, menus, and modals get one.

## Motion

Five durations: 0, 100ms (`--duration-quick`), 200ms (`--duration-standard`), 400ms
(`--duration-considered`), 600ms (`--duration-cinematic`). Three easings: `--ease-quiet-out`
(`cubic-bezier(0.23, 1, 0.32, 1)`) for entrances, `--ease-quiet-in` for exits, `--ease-quiet-both`
for a change that stays.

A pressed control scales to 0.97, so a click is acknowledged; `Button` does this and
`motion-reduce:active:scale-100` drops it under reduced motion. Nothing moves or scales on hover, and
Tailwind v4 applies `hover:` only where the pointer can hover. Transition named properties, never
`transition-all`.

The landing sheet has the one orchestrated entrance: `animate-sheet-rise`, then `animate-band-wipe`
on the stage band. Anything used many times a day, a menu, a keyboard action, a theme switch, does not
animate.

Reduced motion collapses every duration and every delay to zero at the token level, so components
inherit the decision rather than each re-implementing it.

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
- A mermaid fence stays a diagram. `ArtifactDocument` splits the body at fences, and each piece
  derives its heading ids from the heading text, so a piece needs no knowledge of where it sits in
  the document. Do not reintroduce a positional cursor: the one that existed drifted whenever the
  outline and the renderer disagreed about what counted as a heading.

## One description per page

The workflow is described once per page, each description with one job.

- `components/stage-stepper.tsx` is the map: a band with one column per stage and one segment per
  phase, ink when ready, part-filled brand where the reader is. `components/stage-band.tsx` holds the
  segments, so the dashboard rows draw the same band without the labels.
- `components/next-action-panel.tsx` is the instruction on the project page, and
  `components/next-action-button.tsx` the instruction elsewhere. A stage under review with untraced
  claims is named by its count: "Settle 2 untraced claims in Requirements".
- `components/phase-ledger.tsx` is the ledger on the project page: every phase, its stage and its
  status, in stage order rather than storage order.
- `components/add-section-menu.tsx` is the one control that brings a skipped phase back.
- `components/project-nav.tsx` is the sidebar on a phase page: every phase, grouped by stage, with
  its status, and the current phase marked. Below `lg` it folds into one button that names the
  project and phase and opens the same list as a drawer. The phase page's heading is the phase name.

**`lib/workflow.ts` owns the phase labels and the phase lookup**: `phaseState`, `stageTargetPhase` and
`currentPhaseFor` are the one reading of a phase's status, and `PROJECT_OUTLINE` is the one reading
order, so the band, the ledger, the sidebar and the next action
cannot disagree. Do not add another description of the same eight phases.

## Layout

A working surface sits on a sheet: `rounded-lg border border-line bg-surface` on the page ground.
The project workspace, a phase's document, and the project list each get one. The phase page splits
into two tabs, the document and the clarifications, and opens on whichever the phase needs next.

The reading surface puts the contents rail on the left: section numbers, a gap word for any section
whose claims are unsettled, and the document's claim totals at the foot. A claim bullet renders as a
hallmark, its ID stamped solid once confirmed, outlined while proposed, dashed while untraced. The
`hallmark` utility draws the same stamp in React, as `SpecClause` does on the landing page.

## Components

`components/ui/` holds the primitives. The set is themed with the design tokens and keeps the export
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
