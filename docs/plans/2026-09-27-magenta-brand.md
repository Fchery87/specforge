# Magenta brand implementation plan

**Status:** In progress. Task 1 of 8 is in progress.

**Spec:** [Magenta brand](../specs/2026-09-27-magenta-brand.md)

## Tasks

Tokens and their gates first, so every later step is checked against the new values. Then the rename,
which is mechanical and touches the most files. Then the type, mark and primitives, then the surfaces
that need a human eye.

| # | Task | State | SHA | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Write ADR 0002, this plan, the spec, and the roadmap entry. | In progress | — | `node .keel/validate-docs-lifecycle.mjs` |
| 2 | Rewrite `design/tokens.json` and the `:root` and `.dark` blocks of `app/globals.css` with the Magenta values and semantic names. Move `design/audit-contrast.mjs`, `design/audit-token-sync.mjs` and `design/lint-tokens.mjs` to the new names. | Not started | — | `node design/audit-contrast.mjs` and `node design/audit-token-sync.mjs` exit zero |
| 3 | Codemod the hue utilities to semantic names across `app`, `components`, `hooks`, `lib` and their tests. | Not started | — | the grep in the spec's success criterion 3 returns nothing; `npm run typecheck`; the suite passes |
| 4 | Load Funnel Display, Funnel Sans and Red Hat Mono; add `--font-display`; delete `--font-serif`; move tracking into the type scale; set `document-prose` in Funnel Sans. | Not started | — | `node design/audit-page.mjs` reports three families on `/` and `/design` |
| 5 | Replace the mark with inline SVG in `components/ui/logo.tsx`, add `app/icon.svg`, delete `public/specforge-logo-emblem.jpg`. | Not started | — | logo tests pass; screenshots |
| 6 | Primitives: button press feedback, radii, the ease-out curve, Clerk appearance and the mermaid theme. | Not started | — | `npx vitest --run components/ui`; screenshots of `/sign-in` |
| 7 | Landing hero to the approved composition, and the design docs (`docs/design.md`, `components/AGENTS.md`, `design/README.md`) to the new system. | Not started | — | screenshots at desktop and mobile in both themes |
| 8 | Gates at one revision. | Not started | — | `npm run typecheck`, `npm run lint`, `npm run test -- --run --reporter=dot --testTimeout=20000`, `npm run build`, `node design/audit-contrast.mjs`, `node design/audit-token-sync.mjs`, the whole-tree palette lint and `node .keel/validate-docs-lifecycle.mjs` all exit zero |

States: `Not started`, `In progress`, `Done, unverified`, `Done`.

`Done` requires a real SHA that passes `git cat-file -t`, and a verification that
actually ran. `Done, unverified` is honest and must say what is missing.
