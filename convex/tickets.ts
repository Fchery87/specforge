import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tickets')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .order('asc')
      .collect();
  },
});

export const listByPhase = query({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tickets')
      .withIndex('by_project_phase', (q) =>
        q.eq('projectId', args.projectId).eq('phaseId', args.phaseId)
      )
      .order('asc')
      .collect();
  },
});

export const updateStatus = mutation({
  args: {
    ticketId: v.id('tickets'),
    status: v.union(
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done'),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const deleteTicket = mutation({
  args: { ticketId: v.id('tickets') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.ticketId);
  },
});

export const reorder = mutation({
  args: {
    ticketId: v.id('tickets'),
    newOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      order: args.newOrder,
      updatedAt: Date.now(),
    });
  },
});

export const insertTicket = mutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    artifactId: v.optional(v.id('artifacts')),
    title: v.string(),
    description: v.string(),
    acceptanceCriteria: v.array(v.string()),
    status: v.union(
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done'),
    ),
    priority: v.union(
      v.literal('critical'),
      v.literal('high'),
      v.literal('medium'),
      v.literal('low'),
    ),
    estimatedEffort: v.optional(v.string()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('tickets', {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});
