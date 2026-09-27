# 0002. Replace the Ember palette and type with the Magenta brand

**Date:** 2026-09-27
**Status:** Accepted
**Supersedes:** the palette and type decisions in [ADR 0001](0001-ember-design-system.md). Its structural
decisions stand.

## Context

ADR 0001 replaced the brutalist identity with Ember and fixed real problems: one token source,
contrast that passes, a document surface for the specification, and lint gates that keep the system
from eroding. Those structural decisions were right and this ADR keeps them.

Ember's look did not survive a review with the product owner. A near-black ground with one warm clay
accent, set in Inter with Source Serif and JetBrains Mono, is the most common look for AI-built
developer tools in 2026. The owner called it dated and not captivating, and rejected a second
direction (Temper: a steel ground, a five-colour temper scale, Archivo at variable width) for the same
reason. The owner fixed the grounds themselves: a clean off-white in light, a true dark black in
dark.

Three directions were then built on those grounds in `design/prototypes/brand-directions.html`,
differing only in type and accent: Cobalt, Signal, and Magenta. The owner chose Magenta.

## Decision

**Grounds.** Light is a neutral off-white `#f7f7f7` with white `#ffffff` documents. Dark is `#0a0a0a`
with `#111111` panels. Both are neutral greys with no hue, so the accent is the only colour on
screen that is not a state.

**Accent.** One magenta, `#d10f6f` in light and `#ff3d9a` in dark, named `brand`. It is the primary
action, the focus ring, a link, and "you are here" on the stage map. The light value was darkened from
the prototype's `#e4127a` so that one token clears 4.5:1 both as text on the ground and under a white
label, which keeps the accent a single token rather than a fill and a text variant.

**States.** Named for what they mean, not for their hue: `success`, `warning`, `destructive`, `info`.
The Ember hue names (`ember`, `sage`, `brick`, `amber`, `slate`) are deleted, because a token called
`ember` that renders magenta would mislead every reader of the code.

**Type.** Funnel Display for headings and display text, Funnel Sans for interface and document prose,
Red Hat Mono for identifiers, claim IDs and code. The separate serif document face is retired: the
approved prototype sets specification prose in Funnel Sans, and three families is the ceiling.
Display tracking lives in the type scale, so no call site sets tracking.

**Shape.** Radius stays three values and moves up: 10px for controls, 16px for containers, full for
pills.

**Mark.** The section sign on a rounded tile, with a magenta dot for the claim it certifies, drawn as
inline SVG so it follows the theme. The raster emblem is deleted.

**Motion.** A pressed control scales to 0.97. Hover styles apply only where the pointer can hover.
The ease-out curve is strengthened to `cubic-bezier(0.23, 1, 0.32, 1)`.

## Consequences

Every surface changes colour and type in one wave, as ADR 0001 required of its own migration, for
the same reason: a product rendering two palettes is worse than either one alone.

The hue-to-semantic rename touches roughly 380 utility uses, including tests that assert on class
names. The rename is mechanical, and a test updated by it is updated because the token was renamed,
not to make an assertion stop failing.

`design/tokens.json`, `design/audit-contrast.mjs`, `design/audit-token-sync.mjs` and the palette lint
move to the new names, so the gates keep proving the same properties about the new values.

The reading surface loses its serif. Long-form reading relies on Funnel Sans at 17 on 28 under a 68
character measure. If reading comfort is reported as worse, a text serif can return as a fourth role
through a new decision, not a call-site override.

## Alternatives considered

**Keep Ember and refine it.** Rejected by the product owner. The measured problems ADR 0001 solved
are not in question; the identity is.

**Temper.** A steel ground with a temper-colour stage scale and Archivo at variable width. Rejected as
dated.

**Cobalt and Signal.** Built on the same grounds, differing in type and accent. Not chosen. Both
remain in the directions prototype as the record of what was compared.
