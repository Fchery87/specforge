import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { v, type Infer } from 'convex/values';
import { canAccessProject } from '../lib/authz';
import { PHASE_ORDER, type PhaseId } from '../lib/workflow';
import { bugReportValidator, changeOpValidator } from './schema';

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

export const abandonChange = mutation({
  args: { changeId: v.id('changes') },
  handler: abandonChangeHandler,
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
