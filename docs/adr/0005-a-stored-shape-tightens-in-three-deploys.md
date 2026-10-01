# 0005. A stored shape tightens in three deploys, with the migration between them

**Status:** Accepted
**Date:** 2026-09-30

## Context

Phase 10 changed what a stored question is. It gained `source`, `feeds` and an answer origin, and
lost the `aiGenerated` flag. The Convex schema validates every row on push, so a schema that
requires a field the stored rows lack, or forbids one they carry, fails the push.

The work shipped as a stack of pull requests that were squash-merged. A squash turns a stack into
one commit per pull request, so the order the pull requests deploy in is the only order the
history keeps. The first attempt at this ordering nearly put the strict schema and the migration in
one pull request, which cannot be deployed in the right order.

## Decision

A change that makes a stored shape stricter ships as three separate pull requests, deployed in
order:

1. **Widen.** The validator accepts both shapes: new fields optional, removed fields still allowed.
   All code stops reading and writing the old shape. Nothing yet depends on the data being clean.
2. **Migrate.** An idempotent internal mutation brings every row to the new shape, with a driver
   that pages through the table and returns counts. It is run on each deployment after step 1, and
   a second run must report zero.
3. **Narrow.** The validator requires the new shape and drops the old one. It deploys only after
   step 2 has run on that deployment.

The migration keeps whatever lets a later run be a no-op: a row already in the new shape is
returned unchanged.

## Alternatives

- **One pull request with the migration and the strict schema.** Rejected: it deploys in one push,
  and the schema validates before any migration can run.
- **A migration framework.** Rejected for now: the repo has none, one mutation and a paging driver
  covered 136 questions, and a framework is more than that needs.
- **Leave the old field optional forever.** Rejected: two shapes in one validator is how a reader
  stops knowing which fields a row has.

## Consequences

Easier: each deploy is valid on its own, a failed step leaves the previous one running, and the
migration can be rerun safely.

Harder: a change that could be one commit is three, and the second step is a manual command on each
deployment, with nothing in CI to remind anyone.

Foreclosed: shipping a strict schema in the same deploy as its own migration.

## Revisit when

Several shapes need this in a year. Then the manual step is worth replacing with a migration
framework that records which migrations each deployment has run.
