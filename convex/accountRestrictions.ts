import { internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const getByUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('accountRestrictions')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
  },
});
