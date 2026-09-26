# SpecForge Redesign Brief

Shared source of truth for the three direction prototypes. Everything here is settled unless the
direction section says otherwise.

## Product

SpecForge turns a product brief into rigorous, evidence-backed software specifications, then exports
them as agent-readable handoff packs for coding agents (Claude Code, Cursor, Codex).

Audience. Developers and engineering leads already working with coding agents. They are fast,
skeptical of marketing, and read dense technical text for a living.

The core object. A multi-thousand-word specification: numbered clauses, requirement IDs, claim IDs,
evidence links, blocking dependencies between tasks.

Real vocabulary to use. Keep these exact names, they are load-bearing.
- Three stages: Requirements, Design, Tasks.
- Eight phases: Constitution (shown to users as Project Rules), Brief, PRD, Domain Model,
  Architecture, Schemas, Tasks, Export.
- Modes: Lite, Full, Backend.
- Features: evidence-backed specs, claim IDs, vertical tracer bullets with blocking edges,
  stress-test grilling, live schema validation, agent-native handoff.
- Status words: Draft, Generating, Needs review, Confirmed, Skipped, Stale.

## The opening in the market

Every competitor (GitHub Spec Kit, Amazon Kiro, Tessl, OpenSpec, BMAD) ships markdown files inside an
IDE, or a chat box. The stated pain from reviewers of those tools is: "I would rather review code
than all these markdown files. An effective SDD tool would have to provide a very good spec review
experience." Nobody treats the spec as a rendered, navigable, annotated document surface.

So the design's center of gravity is the review surface, not the chat that produced it.

## Palette

Ember. Warm accent on a near-black ground, with muted semantics. Accent values are functional only.
Never a decorative gradient, never a glow.

Dark (primary, this is what the prototypes render).

| Token | Hex | Role | Minimum contrast |
| --- | --- | --- | --- |
| void | `#09090a` | page ground | |
| surface | `#111113` | panels, rows | |
| panel | `#17171a` | overlays, menus | |
| raised | `#202024` | selected row | |
| line | `#26262b` | decorative hairline | none, it only has to be visible |
| lineStrong | `#3a3a44` | grouped divider | none |
| field | `#6a6a74` | input boundary | 3:1 against its surface |
| dim | `#85858f` | labels, keybindings | 4.5:1 |
| muted | `#a1a1ab` | values, descriptors | 4.5:1 |
| text | `#e9e9ec` | content | 4.5:1 |
| textBright | `#fafafa` | content on raised | 4.5:1 |
| ember | `#c87a46` | accent, active state, focus | 4.5:1 as text, 3:1 as focus ring |
| emberSoft | `#e0a479` | headings, inline code | 4.5:1 |
| emberDeep | `#7d4726` | track fill, quiet accent | no text use |
| sage | `#7fa37a` | success, additions | 4.5:1 |
| brick | `#c97070` | error, deletions | 4.5:1 |
| amber | `#c6a052` | warning, needs review | 4.5:1 |
| slate | `#6f92a6` | links, keywords | 4.5:1 |

The greys were raised from the source palette so that `dim` clears 4.5:1 on both ground and surface.
`design/tokens.json` is the authoritative copy and `design/audit-contrast.mjs` proves it.

Light mode is a later pass. If a prototype renders light, use a neutral (not cream) ground
`#FCFCFD` with `#FFFFFF` panels and the light accent `#a05526`. Do not reuse the dark accent hex on a
light ground, and do not invent a cream or parchment ground.

## Type

Load from Google Fonts. Available family names: `Inter`, `Geist`, `Geist Mono`, `JetBrains Mono`,
`Source Serif 4`, `Newsreader`, `Spectral`, `Instrument Serif`, `Literata`.

Non-negotiable rules.
- Three roles maximum: UI chrome, document prose, identifiers and code.
- Display sizes get negative tracking. Do not exceed 64px on a desktop hero, weight 400 to 600.
- Enable tabular numerals wherever numbers align in columns.
- Body line length under 80 characters. Serif body gets more line height than sans.

## Structural standards (2026)

These are measured conventions from the best current developer tools. Follow them.

1. Spacing is a 4px scale. No off-scale values.
2. Radius uses at most three values. Suggested: 6px controls, 12px containers, full for pills.
3. Elevation is border-first: 1px hairlines define layers. Shadows are for popovers and modals only,
   low opacity, and never on the dark ground for a resting element.
4. Motion uses five durations only: 0, 100, 200, 400, 600ms. Entrances ease-out, exits ease-in, and
   exits run at half the entrance duration. Reduced motion collapses durations to 0.
5. Focus is visible: 2px outline, 2px offset, on `:focus-visible`, in both themes, never suppressed.
   Two-tone (inner accent, outer ground) where the background varies.
6. Every data surface needs four designed states: loading, loaded, empty, failed. Skeletons are for
   containers and data, never for toasts, menus, or modals.
7. Contrast: body text at least 4.5:1 against its surface. The accent as a focus ring at least 3:1.
8. Tables ship comfortable and compact density. Dense views are a feature, not a compromise.

## Hard rules

- No decorative gradients, no glow shadows, no noise or grain overlay, no glassmorphism.
- No all-caps eyebrow label above a heading. No "A · B · C" middle-dot meta strings. No arrow glyph
  appended to link text. No tilde-prefixed version labels.
- Numbering is allowed only where the content is genuinely a sequence. The eight phases qualify. A
  feature grid does not.
- No emoji. No em dashes in interface copy.
- Icons: use inline SVG or a CDN-loaded icon set. Keep them 1.5px stroke, currentColor.
- Copy is written from the user's side, in sentence case, active voice. A button says what happens.
- Do not use lorem ipsum. Use the real vocabulary above and write plausible technical content.

## Deliverable

One self-contained HTML file per direction at `design/prototypes/<direction>.html`. Inline all CSS.
Fonts may load from the Google Fonts CDN. No build step, no JavaScript frameworks. Minimal vanilla JS
is allowed only for a tab or step interaction if it earns its place.

Each file renders three stacked sections at 1440px design width, separated by a full-width divider so
they can be screenshotted independently.

1. **Landing hero.** The first thing a visitor sees. What the product is, and one primary action.
   The hero must show the product, not describe it in adjectives.
2. **Spec review surface.** The core object: a rendered specification with numbered clauses, claim
   IDs, evidence markers, and navigation. This is the most important section. Spend the most effort
   here. It must be legible as a real document someone would read for an hour.
3. **Pipeline state.** The three stages and eight phases with per-phase status, the current position,
   and the next action.

Include realistic content, not placeholders. A believable spec clause reads like:
"A workspace member with the editor role may archive a project. Archiving sets `status = archived`,
keeps all artifacts readable, and writes one audit event. Archived projects do not accept new
generation runs."

## The three directions

Each direction takes a different structural bet. They must not converge on the same layout.

### direction-1-field-manual
An engineering document press. Serif display and serif spec prose, hairline rules, marginal numbering
and margin notes for claim IDs and evidence, near-zero chrome. Hero shows a real spec page rendered
as a document. Voice of a technical standard. Risk to manage: do not let it read as a book. It must
still feel like a tool with state.

### direction-2-instrument-panel
Precision instrument. Sans everywhere, tight role-based scale, mono for all identifiers, border-first
surfaces, higher information density, visible state everywhere (phase gates, blocking edges,
conformance scores). Hero shows the live pipeline and a streaming artifact. Voice of a cockpit. Risk
to manage: do not let it read as a Linear clone. The differentiation has to come from the pipeline and
evidence structure, not the palette.

### direction-3-proof-sheet
Evidence is the hero. The interface makes the trust chain the most compelling thing on screen: every
claim carries a margin mark tying it to an interview answer and a commit-pinned file, with the chain
visible inline. Hero shows one claim and its full evidence trail. Mixed typography: serif for claim
and spec text, mono for IDs and hashes, sans for chrome. Risk to manage: connectors and metadata get
busy. Restraint is the whole job.
