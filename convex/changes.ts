import { internalQuery, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { v, type Infer } from 'convex/values';
import { canAccessProject } from '../lib/authz';
import { PHASE_ORDER, type PhaseId } from '../lib/workflow';
import { bugReportValidator, changeOpValidator } from './schema';
import { formatChangeId } from '../lib/changes/format';

export type ChangeOp = Infer<typeof changeOpValidator>;
export type BugReport = Infer<typeof bugReportValidator>;

export interface ChangeOpInput {
  reason: string;
  evidenceSourceIds: Id<'evidenceSources'>[];
  op: ChangeOp;
}

const changeOpInputValidator = v.object({
  reason: v.string(),
  evidenceSourceIds: v.array(v.id('evidenceSources')),
  op: changeOpValidator,
});

async function requireProjectOwner(ctx: QueryCtx | MutationCtx, projectId: Id<'projects'>) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error('Project not found');
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !canAccessProject(project.userId, identity.subject)) throw new Error('Forbidden');
  return project;
}

async function requireChangeOwner(ctx: QueryCtx | MutationCtx, changeId: Id<'changes'>) {
  const change = await ctx.db.get(changeId);
  if (!change) throw new Error('Change not found');
  const project = await requireProjectOwner(ctx, change.projectId);
  return { change, project };
}

/** A claim a change may act on: live, in this project, and part of the workflow's documents. */
function isBaselineClaim(claim: Doc<'claims'>): boolean {
  return claim.retiredAt === undefined && PHASE_ORDER.includes(claim.phaseId as PhaseId);
}

function hasBugReport(bug: BugReport | undefined): bug is BugReport {
  return Boolean(bug?.observed.trim() && bug.expected.trim() && bug.reproduction.trim());
}

export async function createChangeHandler(
  ctx: MutationCtx,
  args: {
    projectId: Id<'projects'>;
    kind: 'feature' | 'bugfix';
    title: string;
    summary: string;
    bug?: BugReport;
  },
): Promise<Id<'changes'>> {
  const project = await requireProjectOwner(ctx, args.projectId);
  const title = args.title.trim();
  const summary = args.summary.trim();
  if (!title || !summary) throw new Error('A change needs a title and a description');
  if (args.kind === 'bugfix' && !hasBugReport(args.bug)) {
    throw new Error('A bug fix needs the observed behaviour, the expected behaviour and the steps to reproduce it');
  }
  if (args.kind === 'feature' && args.bug) throw new Error('Only a bug fix carries a bug report');

  const claims = await ctx.db
    .query('claims')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  if (!claims.some(isBaselineClaim)) {
    throw new Error("Generate the project's requirements before starting a change");
  }

  const changeNumber = project.nextChangeNumber ?? 1;
  const now = Date.now();
  const changeId = await ctx.db.insert('changes', {
    projectId: args.projectId,
    changeNumber,
    kind: args.kind,
    title,
    summary,
    ...(args.kind === 'bugfix' && args.bug
      ? {
          bug: {
            observed: args.bug.observed.trim(),
            expected: args.bug.expected.trim(),
            reproduction: args.bug.reproduction.trim(),
          },
        }
      : {}),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.patch(args.projectId, { nextChangeNumber: changeNumber + 1 });
  return changeId;
}

async function validateOp(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  input: ChangeOpInput,
  position: number,
): Promise<ChangeOpInput> {
  const label = `Operation ${position}`;
  const reason = input.reason.trim();
  if (!reason) throw new Error(`${label} needs a reason`);

  for (const sourceId of input.evidenceSourceIds) {
    const source = await ctx.db.get(sourceId);
    if (!source || source.projectId !== projectId) throw new Error(`${label} cites evidence from another project`);
  }

  const { op } = input;
  if (op.type === 'add') {
    if (!PHASE_ORDER.includes(op.phaseId as PhaseId)) throw new Error(`${label} adds to an unknown phase`);
    if (!op.text.trim()) throw new Error(`${label} adds an empty requirement`);
    return { reason, evidenceSourceIds: input.evidenceSourceIds, op: { ...op, text: op.text.trim() } };
  }

  const claim = await ctx.db.get(op.claim);
  if (!claim || claim.projectId !== projectId || !isBaselineClaim(claim)) {
    throw new Error(`${label} targets a requirement that is not live in this project`);
  }
  if (op.type === 'modify') {
    const text = op.text.trim();
    if (!text) throw new Error(`${label} rewrites a requirement as empty`);
    if (text === op.baseText.trim()) throw new Error(`${label} does not change the wording`);
    return { reason, evidenceSourceIds: input.evidenceSourceIds, op: { ...op, text } };
  }
  return { reason, evidenceSourceIds: input.evidenceSourceIds, op };
}

/** Replaces a draft's operations wholesale, which is how the review page saves an edit. */
export async function replaceChangeOpsHandler(
  ctx: MutationCtx,
  args: { changeId: Id<'changes'>; ops: ChangeOpInput[] },
): Promise<void> {
  const { change } = await requireChangeOwner(ctx, args.changeId);
  if (change.status !== 'draft') throw new Error('Only a draft change can be edited');

  const validated: ChangeOpInput[] = [];
  for (const [index, input] of args.ops.entries()) {
    validated.push(await validateOp(ctx, change.projectId, input, index + 1));
  }

  const existing = await ctx.db
    .query('changeOps')
    .withIndex('by_change', (q) => q.eq('changeId', args.changeId))
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);
  for (const [order, input] of validated.entries()) {
    await ctx.db.insert('changeOps', { changeId: args.changeId, order, ...input });
  }
  await ctx.db.patch(args.changeId, { updatedAt: Date.now() });
}

export async function abandonChangeHandler(
  ctx: MutationCtx,
  args: { changeId: Id<'changes'> },
): Promise<void> {
  const { change } = await requireChangeOwner(ctx, args.changeId);
  if (change.status !== 'draft') throw new Error('Only a draft change can be abandoned');
  await ctx.db.patch(args.changeId, { status: 'abandoned', updatedAt: Date.now() });
}

export type ApplyChangeResult =
  | { status: 'applied'; addedClaimIds: string[] }
  | { status: 'conflict'; conflicts: Array<{ order: number; claimId: string | null; reason: string }> };

type OpRow = Doc<'changeOps'>;
type TargetedOp = Exclude<ChangeOp, { type: 'add' }>;

/**
 * Every targeted claim must still read the wording the op was drafted against, and no two ops may
 * target the same claim. Returns the problems rather than throwing, so the page can name them.
 */
async function findConflicts(ctx: MutationCtx, projectId: Id<'projects'>, rows: OpRow[]) {
  const conflicts: Array<{ order: number; claimId: string | null; reason: string }> = [];
  const targeted = new Map<string, number>();
  for (const row of rows) {
    if (row.op.type === 'add') continue;
    const op: TargetedOp = row.op;
    const claim = await ctx.db.get(op.claim);
    const claimId = claim?.claimId ?? null;
    if (!claim || claim.projectId !== projectId || !isBaselineClaim(claim)) {
      conflicts.push({ order: row.order, claimId, reason: 'The requirement is no longer live' });
      continue;
    }
    if (claim.text.trim() !== op.baseText.trim()) {
      conflicts.push({ order: row.order, claimId, reason: 'The requirement was reworded after this change was drafted' });
    }
    const earlier = targeted.get(String(op.claim));
    if (earlier !== undefined) {
      conflicts.push({ order: row.order, claimId, reason: `Operation ${earlier + 1} already targets this requirement` });
    }
    targeted.set(String(op.claim), row.order);
  }
  return conflicts;
}

async function linkEvidence(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  claim: Id<'claims'>,
  sourceIds: Id<'evidenceSources'>[],
  now: number,
) {
  const existing = await ctx.db
    .query('evidenceLinks')
    .withIndex('by_claim', (q) => q.eq('claimId', claim))
    .collect();
  const linked = new Set(existing.map((link) => String(link.sourceId)));
  for (const sourceId of sourceIds) {
    if (linked.has(String(sourceId))) continue;
    await ctx.db.insert('evidenceLinks', { projectId, claimId: claim, sourceId, supportStatus: 'suggested', createdAt: now });
  }
}

/**
 * Applies a draft in one transaction: adds issue new IDs, modifies keep the ID and record the old
 * wording, removes retire. Nothing is written when any op conflicts. Every phase whose requirements
 * moved is marked stale until it is regenerated, and its verification results are marked outdated.
 */
export async function applyChangeHandler(
  ctx: MutationCtx,
  args: { changeId: Id<'changes'> },
): Promise<ApplyChangeResult> {
  const { change, project } = await requireChangeOwner(ctx, args.changeId);
  if (change.status !== 'draft') throw new Error('Only a draft change can be applied');

  const rows = (
    await ctx.db
      .query('changeOps')
      .withIndex('by_change', (q) => q.eq('changeId', args.changeId))
      .collect()
  ).sort((a, b) => a.order - b.order);
  if (rows.length === 0) throw new Error('A change needs at least one operation');
  if (
    change.kind === 'bugfix' &&
    !rows.some((row) => row.op.type === 'add' && row.op.kind === 'acceptance_criterion')
  ) {
    throw new Error('A bug fix needs at least one added acceptance criterion: the regression test');
  }

  const conflicts = await findConflicts(ctx, change.projectId, rows);
  if (conflicts.length > 0) return { status: 'conflict', conflicts };

  const now = Date.now();
  const touchedPhases = new Set<string>();
  const addedClaimIds: string[] = [];
  let nextClaimNumber = project.nextClaimNumber ?? 1;

  for (const row of rows) {
    const { op } = row;
    if (op.type === 'add') {
      const artifact = await ctx.db
        .query('artifacts')
        .withIndex('by_phase', (q) => q.eq('projectId', change.projectId).eq('phaseId', op.phaseId))
        .first();
      if (!artifact) {
        throw new Error(`Operation ${row.order + 1} adds to a phase that has no document yet`);
      }
      const claimId = `REQ-${String(nextClaimNumber++).padStart(4, '0')}`;
      const claim = await ctx.db.insert('claims', {
        projectId: change.projectId,
        phaseId: op.phaseId,
        claimId,
        artifactId: artifact._id,
        kind: op.kind,
        text: op.text,
        decisionStatus: 'confirmed',
        reviewStatus: 'current',
        createdAt: now,
        updatedAt: now,
      });
      await linkEvidence(ctx, change.projectId, claim, row.evidenceSourceIds, now);
      addedClaimIds.push(claimId);
      touchedPhases.add(op.phaseId);
      continue;
    }

    const claim = await ctx.db.get(op.claim);
    if (!claim) continue;
    if (op.type === 'modify') {
      await ctx.db.insert('claimRevisions', { claim: claim._id, text: claim.text, changeId: change._id, createdAt: now });
      await ctx.db.patch(claim._id, { text: op.text, decisionStatus: 'confirmed', updatedAt: now });
      touchedPhases.add(claim.phaseId);
    } else if (op.type === 'remove') {
      await ctx.db.patch(claim._id, { retiredAt: now, updatedAt: now });
      touchedPhases.add(claim.phaseId);
    }
    if (op.type !== 'remove') await linkEvidence(ctx, change.projectId, claim._id, row.evidenceSourceIds, now);
  }

  if (nextClaimNumber !== (project.nextClaimNumber ?? 1)) {
    await ctx.db.patch(change.projectId, { nextClaimNumber });
  }

  const staleReason = `${formatChangeId(change.changeNumber)} applied`;
  const phases = await ctx.db
    .query('phases')
    .withIndex('by_project', (q) => q.eq('projectId', change.projectId))
    .collect();
  for (const phase of phases) {
    if (touchedPhases.has(phase.phaseId)) {
      await ctx.db.patch(phase._id, { isStale: true, staleReason, staleSince: now });
    }
  }
  const results = await ctx.db
    .query('verificationResults')
    .withIndex('by_project', (q) => q.eq('projectId', change.projectId))
    .collect();
  for (const result of results) {
    if (touchedPhases.has(result.phaseId)) await ctx.db.patch(result._id, { outdatedAt: now });
  }

  await ctx.db.patch(change._id, { status: 'applied', appliedAt: now, updatedAt: now });
  return { status: 'applied', addedClaimIds };
}

export const createChange = mutation({
  args: {
    projectId: v.id('projects'),
    kind: v.union(v.literal('feature'), v.literal('bugfix')),
    title: v.string(),
    summary: v.string(),
    bug: v.optional(bugReportValidator),
  },
  handler: createChangeHandler,
});

export const replaceChangeOps = mutation({
  args: { changeId: v.id('changes'), ops: v.array(changeOpInputValidator) },
  handler: replaceChangeOpsHandler,
});

export const applyChange = mutation({
  args: { changeId: v.id('changes') },
  handler: applyChangeHandler,
});

export const abandonChange = mutation({
  args: { changeId: v.id('changes') },
  handler: abandonChangeHandler,
});

const MAX_DRAFT_EVIDENCE = 30;
const MAX_EXCERPT_CHARS = 400;

/**
 * What the draft action needs: the change, the live requirements it may act on, the phases that
 * have a document, and the latest revision of each repository file captured for the project.
 */
export async function getDraftContextHandler(
  ctx: QueryCtx,
  args: { changeId: Id<'changes'>; userId: string },
) {
  const change = await ctx.db.get(args.changeId);
  if (!change) throw new Error('Change not found');
  const project = await ctx.db.get(change.projectId);
  if (!project || !canAccessProject(project.userId, args.userId)) throw new Error('Forbidden');
  if (change.status !== 'draft') throw new Error('Only a draft change can be drafted');

  const claims = (
    await ctx.db
      .query('claims')
      .withIndex('by_project', (q) => q.eq('projectId', change.projectId))
      .collect()
  )
    .filter(isBaselineClaim)
    .sort((a, b) => a.claimId.localeCompare(b.claimId))
    .map((claim) => ({ ref: String(claim._id), claimId: claim.claimId, phaseId: claim.phaseId, text: claim.text }));

  const artifacts = await ctx.db
    .query('artifacts')
    .withIndex('by_project', (q) => q.eq('projectId', change.projectId))
    .collect();
  const phasesWithDocuments = PHASE_ORDER.filter((phaseId) => artifacts.some((artifact) => artifact.phaseId === phaseId));

  const latest = new Map<string, Doc<'evidenceSources'>>();
  const sources = await ctx.db
    .query('evidenceSources')
    .withIndex('by_project', (q) => q.eq('projectId', change.projectId))
    .collect();
  for (const source of sources) {
    if (source.kind !== 'repository_file') continue;
    const current = latest.get(source.sourceKey);
    if (!current || source.revision > current.revision) latest.set(source.sourceKey, source);
  }
  const evidence = [...latest.values()]
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, MAX_DRAFT_EVIDENCE)
    .map((source) => ({ id: String(source._id), locator: source.locator, excerpt: source.excerpt.slice(0, MAX_EXCERPT_CHARS) }));

  return {
    kind: change.kind,
    title: change.title,
    summary: change.summary,
    ...(change.bug ? { bug: change.bug } : {}),
    claims,
    phasesWithDocuments,
    evidence,
  };
}

export const getDraftContextInternal = internalQuery({
  args: { changeId: v.id('changes'), userId: v.string() },
  handler: getDraftContextHandler,
});

export const listChanges = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    await requireProjectOwner(ctx, args.projectId);
    const changes = await ctx.db
      .query('changes')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    return changes.sort((a, b) => b.changeNumber - a.changeNumber);
  },
});

/** A change with its operations in order, each targeted claim resolved to its current ID and wording. */
export const getChange = query({
  args: { changeId: v.id('changes') },
  handler: async (ctx, args) => {
    const { change } = await requireChangeOwner(ctx, args.changeId);
    const rows = await ctx.db
      .query('changeOps')
      .withIndex('by_change', (q) => q.eq('changeId', args.changeId))
      .collect();
    const ops = await Promise.all(
      rows
        .sort((a, b) => a.order - b.order)
        .map(async (row) => {
          if (row.op.type === 'add') return { ...row, target: null };
          const claim = await ctx.db.get(row.op.claim);
          return {
            ...row,
            target: claim
              ? { claimId: claim.claimId, text: claim.text, phaseId: claim.phaseId, live: claim.retiredAt === undefined }
              : null,
          };
        }),
    );
    return { change, ops };
  },
});
