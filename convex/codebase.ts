import { query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

/**
 * Gets the project codebase data for display
 */
export const getCodebase = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const codebase = await ctx.db
      .query('projectCodebase')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .first();

    if (!codebase) return null;

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      return null;
    }

    return codebase;
  },
});
