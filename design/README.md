# Redesign workspace

Working record for the Ember redesign. The permanent documents live in `docs/`:

- [ADR 0001. Replace the brutalist design system with Ember](../docs/adr/0001-ember-design-system.md)
- [Spec. Ember redesign](../docs/specs/2026-09-25-ember-redesign.md)
- [Plan. Ember redesign](../docs/plans/2026-09-25-ember-redesign.md)

## What is here

| Path | What it is |
| --- | --- |
| `brief.md` | The shared brief the direction prototypes were built against: palette, type rules, structural standards, hard rules. |
| `tokens.json` | The palette for both themes. Source of record for the Tailwind `@theme` block. |
| `prototypes/` | Three built design directions, one self-contained HTML file each. |
| `screens/baseline/` | The interface before the change, captured from the running app. |
| `screens/directions/` | Rendered references for the three direction prototypes. |
| `decisions.tsv` | The decision trail. One row per decision, with its evidence. |
| `routes.json` | The routes the screenshot harness captures. |

## Scripts

| Command | What it checks |
| --- | --- |
| `node design/audit-contrast.mjs` | Every colour pair in `tokens.json` against its WCAG 2.2 threshold. Exits non-zero on a failure. |
| `node design/lint-tokens.mjs <files>` | Off-palette colours and retired patterns (glow, glass, noise, gradient decoration, arrow glyphs on links, wide tracking, emoji). |
| `node design/audit-page.mjs <urls>` | A rendered page: font families against the three-role ceiling, distinct type sizes, distinct radii, off-palette colours in computed styles, contrast failures on real text nodes, characters per line in prose, resting shadows, and the computed focus ring. |
| `node design/shot.mjs --label <name>` | Screenshots from `routes.json`. `--file` points at another route list, `--url` at another origin, so it also captures `file://` prototypes. |
