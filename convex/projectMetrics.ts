import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const getProjectMetrics = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx: QueryCtx, args: { projectId: Id<'projects'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const metrics = await ctx.db
      .query('projectMetrics')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .unique();

    if (metrics) return metrics;

    const phases = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();

    const completedPhases = phases.filter((p) => p.status === 'ready').length;
    const totalPhases = phases.length;

    return {
      projectId: args.projectId,
      totalPhases,
      completedPhases,
      completionPercentage: totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0,
      currentPhaseId: phases.find((p) => p.status === 'generating')?.phaseId,
      healthScore: 100,
      stalenessFlags: phases
        .filter((p) => p.isStale)
        .map((p) => ({
          phaseId: p.phaseId,
          isStale: true,
          reason: p.staleReason,
        })),
      verificationStatus: 'not_checked' as const,
      lastActivityAt: project.updatedAt,
      lastActivityType: undefined,
      totalTokensUsed: 0,
      estimatedCost: 0,
      generationCount: completedPhases,
      updatedAt: Date.now(),
    };
  },
});

export const updateProjectMetrics = mutation({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx: MutationCtx, args: { projectId: Id<'projects'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    const phases = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();

    const completedPhases = phases.filter((p) => p.status === 'ready').length;
    const totalPhases = phases.length;

    const verificationResults = await ctx.db
      .query('verificationResults')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .first();

    const staleFlags = phases
      .filter((p) => p.isStale)
      .map((p) => ({
        phaseId: p.phaseId,
        isStale: true as boolean,
        reason: p.staleReason,
      }));

    const healthScore = calculateHealthScore(phases, staleFlags, verificationResults);

    const existing = await ctx.db
      .query('projectMetrics')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .unique();

    const verificationStatus: 'passed' | 'failed' | 'warning' | 'not_checked' = 
      verificationResults?.status === 'pass' ? 'passed' :
      verificationResults?.status === 'fail' ? 'failed' :
      verificationResults?.status ?? 'not_checked';

    const metrics = {
      projectId: args.projectId,
      totalPhases,
      completedPhases,
      completionPercentage: totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0,
      currentPhaseId: phases.find((p) => p.status === 'generating')?.phaseId,
      healthScore,
      stalenessFlags: staleFlags,
      verificationStatus,
      lastActivityAt: project.updatedAt,
      lastActivityType: undefined,
      totalTokensUsed: 0,
      estimatedCost: 0,
      generationCount: completedPhases,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, metrics);
      return { success: true, metricsId: existing._id };
    }

    const id = await ctx.db.insert('projectMetrics', metrics);
    return { success: true, metricsId: id };
  },
});

export const addProjectTag = mutation({
  args: {
    projectId: v.id('projects'),
    tag: v.string(),
  },
  handler: async (ctx: MutationCtx, args: { projectId: Id<'projects'>; tag: string }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    const normalizedTag = args.tag.toLowerCase().trim();

    const existing = await ctx.db
      .query('projectTags')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('tag'), normalizedTag))
      .first();

    if (existing) {
      return { success: true, action: 'exists' };
    }

    const id = await ctx.db.insert('projectTags', {
      projectId: args.projectId,
      tag: normalizedTag,
      createdAt: Date.now(),
    });

    return { success: true, action: 'created', tagId: id };
  },
});

export const removeProjectTag = mutation({
  args: {
    projectId: v.id('projects'),
    tag: v.string(),
  },
  handler: async (ctx: MutationCtx, args: { projectId: Id<'projects'>; tag: string }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    const tags = await ctx.db
      .query('projectTags')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();

    const tagToRemove = tags.find((t) => t.tag === args.tag.toLowerCase());
    if (!tagToRemove) {
      return { success: true, action: 'not_found' };
    }

    await ctx.db.delete(tagToRemove._id);
    return { success: true, action: 'deleted' };
  },
});

export const getProjectTags = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx: QueryCtx, args: { projectId: Id<'projects'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const tags = await ctx.db
      .query('projectTags')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();

    return tags.map((t) => t.tag);
  },
});

export const getAllTags = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userProjects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect();

    const projectIds = new Set(userProjects.map((p) => p._id));

    const allTags = await ctx.db
      .query('projectTags')
      .collect();

    const tagCounts = allTags
      .filter((t) => projectIds.has(t.projectId))
      .reduce((acc, t) => {
        acc[t.tag] = (acc[t.tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  },
});

function calculateHealthScore(
  phases: { status: string; isStale?: boolean }[],
  staleFlags: { isStale: boolean }[],
  verificationResults?: { status: string; overallScore?: number } | null
): number {
  let score = 100;

  if (staleFlags.length > 0) {
    score -= staleFlags.length * 10;
  }

  if (verificationResults) {
    if (verificationResults.status === 'failed') {
      score -= 30;
    } else if (verificationResults.status === 'warning') {
      score -= 15;
    }

    if (verificationResults.overallScore !== undefined) {
      const verificationContribution = (verificationResults.overallScore / 100) * 20;
      score = score * 0.8 + verificationContribution;
    }
  }

  const errorPhases = phases.filter((p) => p.status === 'error').length;
  if (errorPhases > 0) {
    score -= errorPhases * 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
