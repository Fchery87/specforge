# Workflow and navigation

**Date:** 2026-09-27
**Roadmap:** Phase 6, [Workflow and navigation](../roadmap.md)

## Problem

The product owner reports that SpecForge is hard to navigate and use. A read of the signed-in routes
found the causes in structure, not styling:

1. One thing has several names. The `quick` project mode is "Lite" in `MODE_POLICIES`, "Fast-Track"
   on the new-project page and "Quick Spec" on the dashboard, and "Quick spec" is also a separate
   one-page tool. The other modes carry three names each.
2. The combined questions page, `/project/[id]/questions`, is reachable only from the redirect after
   creating a Lite project. Leave it and there is no way back. Meanwhile the project page's "Generate
   all phases" button generates without showing any answers, so there are two bulk paths that behave
   differently.
3. Creating a project takes two steps, with an optional GitHub step between the form and the project,
   and it lands on a different page for Lite than for the other modes.
4. The phase page moves around one hierarchy six ways (breadcrumbs, stage stepper, eyebrow, stage
   phase links, next-action button, tabs), and its heading is the project title, so every phase page
   has the same headline.

## Goal

A reader always knows where they are in a project and has one way to do each thing. Success is
measurable:

1. Each project mode has one name and one description, read from `MODE_POLICIES` by every surface.
2. "Generate all phases" on the project page opens `/project/[id]/questions`, where the answers are
   reviewed before generation, and that page's button carries the same name.
3. Creating a project is one step and always opens the project page. The repository connection lives
   on the project page.
4. The phase page has a project sidebar listing every phase with its status, and its heading names
   the phase.

## Non-goals

- The Quick spec tool's save flow. It stays a separate tool in this phase.
- A setup check before generation on the dashboard. It is a separate small change.
- Restyling the settings, quick spec and quick history pages.
- The jump-to palette, which stays a later phase and is reconsidered once the navigation exists.

## Approach

### Names

`ModePolicy` gains `description`. The new-project page and the dashboard row read `label` and
`description` from `MODE_POLICIES`. The page keeps only an icon per mode.

### One bulk path

The project page's "Generate all phases" becomes a link to `/project/[id]/questions` and hides once
no phase is pending. The confirmation dialog it opened is deleted. The questions page is retitled
"Generate all phases" and its submit button uses the same words.

### One-step creation

The new-project page creates the project and routes to `/project/[id]`. The project page renders
`CodebaseConnector` below the project rules, so the repository can be connected at any time, not
only at creation.

### Project navigation

Three prototypes were built on the Magenta tokens and captured at desktop and phone widths in
`design/screens/navigation/`:

- A rail: the phase list, with status words, fixed beside the page. On a phone it collapses to a
  button naming the project and phase, which opens the list as a drawer.
- A drawer: the same list behind that button at every width.
- A top bar: the phases as a strip under the site header.

The owner chose the rail. `components/project-nav.tsx` draws it from `PROJECT_OUTLINE` in
`lib/workflow.ts`, the one reading order that `PhaseLedger` also uses, with `PHASE_STATUS_WORDS` as
the one set of status words. On the phase page it replaces the breadcrumbs, the stage stepper and the
stage phase links, and the heading becomes the phase name, under its stage. Below `lg` it folds into
a button that names the project, the phase and its position ("3 of 7", skipped phases not counted)
and opens the same list as a drawer. The owner kept the stage band on the project overview, where it
summarises rather than navigates. Captures of the build are in `design/screens/navigation/built/`.

## Deletion inventory

Deleted by the small fixes:

- `MODE_METADATA`, its badges and the per-mode flow summary in `app/(auth)/dashboard/new/page.tsx`.
- `MODE_WORD` in `components/dashboard/project-card.tsx`.
- The repository step of project creation (`showRepoConnector`, `createdProjectId`,
  `handleSkipRepo`) and the mode-dependent landing route.
- The project page's generate-all confirmation dialog, `handleGenerateAll` and its state.

Deleted by the navigation build:

- `components/stage-phase-links.tsx` and its test. The sidebar lists every phase, which also covers
  the case it existed for, a generated document with no link to it.
- The phase page's use of `Breadcrumbs` and `StageStepper`, and its stage-quality query, which only
  the stepper read. Both components stay in use elsewhere.
- `LEDGER_ORDER`, `groupLabel` and the local status words in `components/phase-ledger.tsx`, replaced
  by `PROJECT_OUTLINE` and `PHASE_STATUS_WORDS`.
