import { internalMutation, internalQuery } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';

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
