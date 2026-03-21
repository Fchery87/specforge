import { query, mutation } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { v } from 'convex/values';

// Shared auth helper: look up ticket -> project -> verify ownership
async function authorizeTicketAccess(
  ctx: QueryCtx | MutationCtx,
  ticketId: string,
): Promise<{ ticket: Doc<'tickets'>; project: Doc<'projects'> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');

  const ticket = await ctx.db.get(ticketId as any);
  if (!ticket) throw new Error('Ticket not found');

  // Type assertion: we know this is a ticket based on the ID
  const typedTicket = ticket as Doc<'tickets'>;
  const project = await ctx.db.get(typedTicket.projectId);
  if (!project) throw new Error('Project not found');

  // Type assertion: we know this is a project based on the ID
  const typedProject = project as Doc<'projects'>;
  if (typedProject.userId !== identity.subject) {
    throw new Error('Forbidden');
  }

  return { ticket: typedTicket, project: typedProject };
}

// Shared auth helper: verify project ownership directly
async function authorizeProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: string,
): Promise<Doc<'projects'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthenticated');

  const project = await ctx.db.get(projectId as any);
  if (!project) throw new Error('Project not found');

  // Type assertion: we know this is a project based on the ID
  const typedProject = project as Doc<'projects'>;
  if (typedProject.userId !== identity.subject) {
    throw new Error('Forbidden');
  }

  return typedProject;
}

// Exported handlers for testing
export async function listByProjectHandler(
  ctx: QueryCtx,
  args: { projectId: any },
) {
  await authorizeProjectAccess(ctx, args.projectId);
  return await ctx.db
    .query('tickets')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .order('asc')
    .collect();
}

export async function listByPhaseHandler(
  ctx: QueryCtx,
  args: { projectId: any; phaseId: string },
) {
  await authorizeProjectAccess(ctx, args.projectId);
  return await ctx.db
    .query('tickets')
    .withIndex('by_project_phase', (q) =>
      q.eq('projectId', args.projectId).eq('phaseId', args.phaseId)
    )
    .order('asc')
    .collect();
}

export async function updateStatusHandler(
  ctx: MutationCtx,
  args: { ticketId: any; status: 'todo' | 'in_progress' | 'done' },
) {
  await authorizeTicketAccess(ctx, args.ticketId);
  await ctx.db.patch(args.ticketId, {
    status: args.status,
    updatedAt: Date.now(),
  });
}

export async function deleteTicketHandler(
  ctx: MutationCtx,
  args: { ticketId: any },
) {
  await authorizeTicketAccess(ctx, args.ticketId);
  await ctx.db.delete(args.ticketId);
}

export async function reorderHandler(
  ctx: MutationCtx,
  args: { ticketId: any; newOrder: number },
) {
  await authorizeTicketAccess(ctx, args.ticketId);
  await ctx.db.patch(args.ticketId, {
    order: args.newOrder,
    updatedAt: Date.now(),
  });
}

export async function insertTicketHandler(
  ctx: MutationCtx,
  args: {
    projectId: any;
    phaseId: string;
    artifactId?: any;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    status: 'todo' | 'in_progress' | 'done';
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedEffort?: string;
    order: number;
  },
) {
  await authorizeProjectAccess(ctx, args.projectId);
  const now = Date.now();
  return await ctx.db.insert('tickets', {
    ...args,
    createdAt: now,
    updatedAt: now,
  });
}

// Convex exports
export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: listByProjectHandler,
});

export const listByPhase = query({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: listByPhaseHandler,
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
  handler: updateStatusHandler,
});

export const deleteTicket = mutation({
  args: { ticketId: v.id('tickets') },
  handler: deleteTicketHandler,
});

export const reorder = mutation({
  args: {
    ticketId: v.id('tickets'),
    newOrder: v.number(),
  },
  handler: reorderHandler,
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
  handler: insertTicketHandler,
});
