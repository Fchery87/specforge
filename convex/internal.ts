import { internalMutation, internalQuery } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';

export function filterArtifactsByPhase<
  T extends { projectId: string; phaseId: string; _id?: string }
>(
  artifacts: T[],
  projectId: string,
  phaseId: string
): T[] {
  return artifacts.filter(
    (artifact) => artifact.projectId === projectId && artifact.phaseId === phaseId
  );
}

export const createArtifact = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    previewHtml: v.string(),
    sections: v.array(
      v.object({ name: v.string(), tokens: v.number(), model: v.string() })
    ),
  },
  handler: async (ctx, args) => {
    const existingArtifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    const toDelete = filterArtifactsByPhase(
      existingArtifacts,
      args.projectId,
      args.phaseId
    );
    for (const artifact of toDelete) {
      await ctx.db.delete(artifact._id);
    }
    return await ctx.db.insert('artifacts', { ...args });
  },
});

export const saveZipToProject = internalMutation({
  args: { projectId: v.id('projects'), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, { zipStorageId: args.storageId });
  },
});

export const updatePhaseStatus = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('generating'),
      v.literal('ready'),
      v.literal('error')
    ),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (phase) {
      await ctx.db.patch(phase._id, { status: args.status });
    }
  },
});
