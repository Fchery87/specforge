import { internalQuery, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { canAccessProject } from '../lib/authz';
import { formatChangeId } from '../lib/changes/format';
import type { DecisionStatus } from '../lib/verification/check';
import type { ScopeChange, ScopeClaim } from '../lib/verification/scope';

async function requireProjectOwner(ctx: QueryCtx, projectId: Id<'projects'>, userId?: string) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error('Project not found');
  const subject = userId ?? (await ctx.auth.getUserIdentity())?.subject;
  if (!subject || !canAccessProject(project.userId, subject)) throw new Error('Forbidden');
  return project;
}

async function connectedRepository(ctx: QueryCtx, projectId: Id<'projects'>) {
  const codebase = await ctx.db
    .query('projectCodebase')
    .withIndex('by_project', (q) => q.eq('projectId', projectId))
    .first();
  return codebase ? { owner: codebase.repoOwner, name: codebase.repoName, url: codebase.repoUrl } : null;
}

export interface CheckContext {
  projectTitle: string;
  repository: { owner: string; name: string; url: string } | null;
  claims: Array<ScopeClaim & { artifactId: Id<'artifacts'>; artifactVersion?: number }>;
  changes: ScopeChange[];
}

/**
 * What a check needs from the database: every requirement (retired ones too, so a citation of one
 * can be explained), and every change with the requirements its edits added, reworded or
 * reaffirmed.
 */
export async function getCheckContextHandler(
  ctx: QueryCtx,
  args: { projectId: Id<'projects'>; userId: string },
): Promise<CheckContext> {
  const project = await requireProjectOwner(ctx, args.projectId, args.userId);
  const claims = await ctx.db
    .query('claims')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  const claimIdByRef = new Map(claims.map((claim) => [claim._id, claim.claimId]));
  const changes = await ctx.db
    .query('changes')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();

  const scopeChanges = await Promise.all(
    changes.map(async (change): Promise<ScopeChange> => {
      const ops = await ctx.db
        .query('changeOps')
        .withIndex('by_change', (q) => q.eq('changeId', change._id))
        .collect();
      const refs = ops.flatMap((row) =>
        row.op.type === 'add' ? (row.appliedClaim ? [row.appliedClaim] : []) : row.op.type === 'remove' ? [] : [row.op.claim],
      );
      return {
        changeId: formatChangeId(change.changeNumber),
        status: change.status,
        claimIds: refs.flatMap((ref) => claimIdByRef.get(ref) ?? []),
      };
    }),
  );

  return {
    projectTitle: project.title,
    repository: await connectedRepository(ctx, args.projectId),
    claims: claims.map((claim) => ({
      claimId: claim.claimId,
      text: claim.text,
      decisionStatus: claim.decisionStatus as DecisionStatus,
      retired: claim.retiredAt !== undefined,
      artifactId: claim.artifactId,
      ...(claim.artifactVersion !== undefined ? { artifactVersion: claim.artifactVersion } : {}),
    })),
    changes: scopeChanges,
  };
}

export const getCheckContextInternal = internalQuery({
  args: { projectId: v.id('projects'), userId: v.string() },
  handler: getCheckContextHandler,
});

export interface CheckSummary {
  _id: Id<'verificationResults'>;
  checkedAt: number;
  status: Doc<'verificationResults'>['status'];
  overallScore: number;
  outdatedAt?: number;
  /** Absent on checks made before phase 8, which were a pasted diff judged against one phase. */
  source?: Doc<'verificationResults'>['source'];
  phaseId?: string;
  counts: { critical: number; major: number; minor: number };
}

function summarise(row: Doc<'verificationResults'>): CheckSummary {
  const severities = row.verdicts ? row.verdicts.map((verdict) => verdict.severity) : row.findings.map((finding) => finding.severity);
  const count = (severity: 'critical' | 'major' | 'minor') => severities.filter((value) => value === severity).length;
  return {
    _id: row._id,
    checkedAt: row.checkedAt,
    status: row.status,
    overallScore: row.overallScore,
    ...(row.outdatedAt !== undefined ? { outdatedAt: row.outdatedAt } : {}),
    ...(row.source ? { source: row.source } : {}),
    ...(row.phaseId !== undefined ? { phaseId: row.phaseId } : {}),
    counts: { critical: count('critical'), major: count('major'), minor: count('minor') },
  };
}

const HISTORY_LIMIT = 20;

/** The project's checks, newest first, old and new shapes alike. */
export async function listChecksHandler(ctx: QueryCtx, args: { projectId: Id<'projects'> }): Promise<CheckSummary[]> {
  await requireProjectOwner(ctx, args.projectId);
  const rows = await ctx.db
    .query('verificationResults')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  return rows
    .sort((a, b) => b.checkedAt - a.checkedAt)
    .slice(0, HISTORY_LIMIT)
    .map(summarise);
}

export const listChecks = query({
  args: { projectId: v.id('projects') },
  handler: listChecksHandler,
});

export interface CheckedRequirement {
  text: string;
  decisionStatus: string;
  reviewStatus: 'current' | 'needs_review';
  retired: boolean;
}

/**
 * One check with the current wording of each requirement it judged, and the repository it read, so
 * quoted lines can link to the file at the head commit.
 */
export async function getCheckHandler(ctx: QueryCtx, args: { checkId: Id<'verificationResults'> }) {
  const check = await ctx.db.get(args.checkId);
  if (!check) throw new Error('Check not found');
  await requireProjectOwner(ctx, check.projectId);

  const judged = new Set((check.verdicts ?? []).map((verdict) => verdict.claimId));
  const requirements: Record<string, CheckedRequirement> = {};
  if (judged.size) {
    const claims = await ctx.db
      .query('claims')
      .withIndex('by_project', (q) => q.eq('projectId', check.projectId))
      .collect();
    for (const claim of claims) {
      if (!judged.has(claim.claimId)) continue;
      requirements[claim.claimId] = {
        text: claim.text,
        decisionStatus: claim.decisionStatus,
        reviewStatus: claim.reviewStatus,
        retired: claim.retiredAt !== undefined,
      };
    }
  }
  const repository = await connectedRepository(ctx, check.projectId);
  return { check, requirements, repositoryUrl: repository?.url ?? null };
}

export const getCheck = query({
  args: { checkId: v.id('verificationResults') },
  handler: getCheckHandler,
});
