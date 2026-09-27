import { query, mutation } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { WORKFLOW_STAGES } from '../lib/workflow';
import { getSectionPlansForPhase, type SectionPlanConfig } from '../lib/llm/section-plans';
import {
  buildStageReport,
  stageQualityFlagFor,
  type StageDocument,
  type StageQualityFlag,
  type StageQualityForExport,
} from '../lib/quality/stage-report';
import { untestableCriteria } from '../lib/validation/acceptance-criteria';
import type { ClaimEvidence, ParsedClaim } from '../lib/claims';

/**
 * The stored requirement-quality report.
 *
 * Two facts about Convex shape this module.
 *
 * First, a query cannot write. The plan asked for "a query that reads a stage's artifact versions,
 * recomputes the report and writes the row", which is not expressible here: `query` handlers are
 * read-only by construction. So the read path recomputes and returns, and the write path is a
 * mutation that recomputes and stores. That split satisfies what the plan wanted the write for —
 * a report cannot describe a revision it did not measure, because the read path never reads a stored
 * report at all.
 *
 * Second, the stored row still earns its place. It is what the export path can read without a user
 * request, and `artifactVersionIds` records exactly which revisions were measured, which a
 * recomputation at export time could no longer reconstruct if a new version had landed since.
 */

/** Only the read side of a context, so the same gathering serves a query and a mutation. */
type ReadCtx = Pick<QueryCtx, 'db'>;

interface StageInputs {
  documents: StageDocument[];
  claims: ParsedClaim[];
  sectionPlan: SectionPlanConfig[];
  criteria: string[];
  criterionClassList: string[];
  artifactVersionIds: Id<'artifactVersions'>[];
}

async function authorizeProjectAccess(
  ctx: Pick<QueryCtx, 'db' | 'auth'>,
  projectId: string
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');

  const project = await ctx.db.get(projectId as Id<'projects'>);
  if (!project) throw new Error('Project not found');

  if (project.userId !== identity.subject) throw new Error('Forbidden');
}

/** A stored claim plus its links, in the shape `lib/claims.ts` reasons about. */
function toParsedClaim(
  claim: {
    claimId: string;
    decisionStatus: string;
    reviewStatus: string;
    text: string;
  },
  evidence: ClaimEvidence[]
): ParsedClaim {
  return {
    claimId: claim.claimId,
    decisionStatus: claim.decisionStatus,
    reviewStatus: claim.reviewStatus,
    text: claim.text,
    evidence,
    // `claimState` reads this, and it is what makes a claim with a suggested-but-unreviewed link
    // count as traced rather than untraced. The links are the evidence, whatever their support
    // status, which is the reading the evidence system already uses.
    hasEvidence: evidence.length > 0,
  };
}

/**
 * Gather everything the report measures for one stage.
 *
 * Reads the latest artifact version of every phase in the stage, the active claims against those
 * artifacts, the stage's section plan, and the criteria its tickets carry. Nothing here writes, which
 * is what lets the query and the mutation share it.
 *
 * Two sources feed one report, and they are deliberately different. Coverage and length read the
 * **text** of the latest versions, because a section exists or a word is written or it is not.
 * Traceability reads the **claim records**, because a claim is a row the evidence system created and
 * reviewed; a claim bullet written into the markdown is prose, and the records are the authority on
 * what was traced and what was not. A stage can therefore show a claim bullet in its text and still
 * report no claims, which is correct rather than a bug, and it is what the evidence spec means by
 * traceability reading the claim records.
 */
async function loadStageInputs(
  ctx: ReadCtx,
  projectId: Id<'projects'>,
  stageId: string
): Promise<StageInputs> {
  const stage = WORKFLOW_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) {
    return {
      documents: [],
      claims: [],
      sectionPlan: [],
      criteria: [],
      criterionClassList: [],
      artifactVersionIds: [],
    };
  }

  // One document per phase, not a joined string: a plan section is matched inside the document the
  // caller will mark, and only the length dimension reads the stage's text joined.
  const documents: StageDocument[] = [];
  const sectionPlan: SectionPlanConfig[] = [];
  const criteria: string[] = [];
  const criterionClassList: string[] = [];
  const artifactVersionIds: Id<'artifactVersions'>[] = [];
  const artifactIds: Id<'artifacts'>[] = [];

  for (const phaseId of stage.phaseIds) {
    sectionPlan.push(...getSectionPlansForPhase(phaseId));

    const artifact = await ctx.db
      .query('artifacts')
      .withIndex('by_phase', (q) => q.eq('projectId', projectId).eq('phaseId', phaseId))
      .first();
    if (!artifact) continue;

    artifactIds.push(artifact._id);

    // `by_artifact_version` orders by the version number, so the latest revision is the first row
    // descending. Ordering by `by_artifact` alone would rely on insertion order instead of on the
    // number that says which revision it is.
    const latestVersion = await ctx.db
      .query('artifactVersions')
      .withIndex('by_artifact_version', (q) => q.eq('artifactId', artifact._id))
      .order('desc')
      .first();

    if (latestVersion) {
      artifactVersionIds.push(latestVersion._id);
      documents.push({ phaseId, markdown: latestVersion.content });
    } else {
      // A legacy artifact with no version row is measured from its current content. Its revision is
      // not recorded, because there is none to record, and it is not claimed to be.
      documents.push({ phaseId, markdown: artifact.content });
    }

    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_project_phase', (q) =>
        q.eq('projectId', projectId).eq('phaseId', phaseId)
      )
      .collect();

    for (const ticket of tickets) {
      criteria.push(...ticket.acceptanceCriteria);
      criterionClassList.push(...(ticket.acceptanceCriteriaQuality ?? []));
    }
  }

  const parsedClaims: ParsedClaim[] = [];
  for (const artifactId of artifactIds) {
    const claims = await ctx.db
      .query('claims')
      .withIndex('by_artifact', (q) => q.eq('artifactId', artifactId))
      .collect();

    for (const claim of claims) {
      if (claim.retiredAt !== undefined) continue;

      const links = await ctx.db
        .query('evidenceLinks')
        .withIndex('by_claim', (q) => q.eq('claimId', claim._id))
        .collect();

      const evidence: ClaimEvidence[] = [];
      for (const link of links) {
        const source = await ctx.db.get(link.sourceId);
        evidence.push({
          locator: source?.locator ?? link.locatorDetail ?? 'missing source',
          revision: source?.revisionLabel ?? 'unknown revision',
          support: link.supportStatus,
        });
      }

      parsedClaims.push(toParsedClaim(claim, evidence));
    }
  }

  return {
    documents,
    claims: parsedClaims,
    sectionPlan,
    criteria,
    criterionClassList,
    artifactVersionIds,
  };
}

/**
 * The report for a stage, recomputed on every read.
 *
 * Nothing is read from `stageReports`, so a report can never describe a revision that is no longer
 * stored. The cost is that opening a project recomputes; the work is arithmetic over text already in
 * memory and makes no model call, which is what lets a page afford it.
 */
export async function getStageReportHandler(
  ctx: QueryCtx,
  args: { projectId: Id<'projects'>; stageId: string }
) {
  await authorizeProjectAccess(ctx, args.projectId);
  const inputs = await loadStageInputs(ctx, args.projectId, args.stageId);
  return { report: buildStageReport(inputs), artifactVersionIds: inputs.artifactVersionIds };
}

/**
 * Recompute a stage's report and store it.
 *
 * The mutation rather than the query writes, because Convex queries cannot. Upserts on the
 * `by_project_stage` index so a project has one row per stage rather than a history, and returns what
 * it stored.
 */
export async function saveStageReportHandler(
  ctx: MutationCtx,
  args: { projectId: Id<'projects'>; stageId: string }
) {
  await authorizeProjectAccess(ctx, args.projectId);
  const inputs = await loadStageInputs(ctx, args.projectId, args.stageId);
  const report = buildStageReport(inputs);
  const computedAt = Date.now();

  const existing = await ctx.db
    .query('stageReports')
    .withIndex('by_project_stage', (q) =>
      q.eq('projectId', args.projectId).eq('stageId', args.stageId)
    )
    .first();

  const row = {
    projectId: args.projectId,
    stageId: args.stageId,
    artifactVersionIds: inputs.artifactVersionIds,
    traceability: report.traceability,
    testability: report.testability,
    coverage: report.coverage,
    length: report.length,
    computedAt,
  };

  if (existing) {
    await ctx.db.patch(existing._id, row);
    return { ...row, _id: existing._id };
  }

  const _id = await ctx.db.insert('stageReports', row);
  return { ...row, _id };
}

/**
 * The last stored report for a stage, or null when none was saved.
 *
 * This exists so the table has a reader. A stored snapshot is what the export path needs, since it
 * runs without the user's request and the revisions it measured may since have changed.
 */
export async function getSavedStageReportHandler(
  ctx: QueryCtx,
  args: { projectId: Id<'projects'>; stageId: string }
) {
  await authorizeProjectAccess(ctx, args.projectId);
  return await ctx.db
    .query('stageReports')
    .withIndex('by_project_stage', (q) =>
      q.eq('projectId', args.projectId).eq('stageId', args.stageId)
    )
    .first();
}

/**
 * The mark every stage earns, for the workflow map.
 *
 * One entry per stage, zeros included, because the map renders a stage whether or not anything was
 * measured for it and a missing key would be a second way to say "nothing to report".
 *
 * It reuses `loadStageInputs` and `buildStageReport` rather than counting anything itself. That is the
 * point: the word on the map and the lines on the artifact are two projections of one computation, so
 * they are incapable of disagreeing about how many requirements are untraced. A second count here is
 * how the map would drift from the document it is describing, and the user would have no way to tell
 * which of the two was wrong.
 */
export async function getProjectStageQualityHandler(
  ctx: QueryCtx,
  args: { projectId: Id<'projects'> }
): Promise<Record<string, StageQualityFlag>> {
  await authorizeProjectAccess(ctx, args.projectId);

  const quality: Record<string, StageQualityFlag> = {};
  for (const stage of WORKFLOW_STAGES) {
    const inputs = await loadStageInputs(ctx, args.projectId, stage.id);
    quality[stage.id] = stageQualityFlagFor(buildStageReport(inputs));
  }

  return quality;
}

const reportArgs = {
  projectId: v.id('projects'),
  stageId: v.string(),
};

export const getStageReport = query({
  args: reportArgs,
  handler: getStageReportHandler,
});

export const saveStageReport = mutation({
  args: reportArgs,
  handler: saveStageReportHandler,
});

export const getSavedStageReport = query({
  args: reportArgs,
  handler: getSavedStageReportHandler,
});

export const getProjectStageQuality = query({
  args: { projectId: v.id('projects') },
  handler: getProjectStageQualityHandler,
});

/**
 * The requirement-quality signal the export pack carries, one entry per workflow stage in order.
 *
 * The pack reads this recomputed report rather than a stored `stageReports` row. Nothing writes those
 * rows yet outside this module's own writer test, and a pack must match what the reader just saw on
 * screen, which is this same path through `loadStageInputs` and `buildStageReport`. A stored snapshot
 * could only answer with the revisions a past write happened to measure.
 *
 * Like every query, this writes nothing.
 */
export async function getExportStageQualityHandler(
  ctx: QueryCtx,
  args: { projectId: Id<'projects'> }
) {
  await authorizeProjectAccess(ctx, args.projectId);

  const stages: StageQualityForExport[] = [];
  for (const stage of WORKFLOW_STAGES) {
    const inputs = await loadStageInputs(ctx, args.projectId, stage.id);
    const report = buildStageReport(inputs);
    stages.push({
      stageId: stage.id,
      stageLabel: stage.label,
      traceability: report.traceability,
      testability: report.testability,
      coverage: report.coverage,
      length: report.length,
      untestableCriteria: untestableCriteria(
        inputs.criteria,
        inputs.criterionClassList
      ),
    });
  }
  return stages;
}

export const getExportStageQuality = query({
  args: { projectId: v.id('projects') },
  handler: getExportStageQualityHandler,
});
