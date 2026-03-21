import { query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

function getPeriodStart(period: '7d' | '30d' | '90d'): number {
  const now = Date.now();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return now - days * 24 * 60 * 60 * 1000;
}

function calculateEstimatedCost(tokens: number): number {
  const pricePer1kTokens = 0.002;
  return (tokens / 1000) * pricePer1kTokens;
}

export const getUserStats = query({
  args: {
    period: v.optional(v.union(
      v.literal('7d'),
      v.literal('30d'),
      v.literal('90d'),
    )),
  },
  handler: async (ctx: QueryCtx, args: {
    period?: '7d' | '30d' | '90d';
  }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const period = args.period ?? '30d';
    const periodStart = getPeriodStart(period);

    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect();

    const phases = await Promise.all(
      projects.map((p) =>
        ctx.db
          .query('phases')
          .withIndex('by_project', (q) => q.eq('projectId', p._id))
          .collect()
      )
    );

    const artifacts = await Promise.all(
      projects.map((p) =>
        ctx.db
          .query('artifacts')
          .withIndex('by_project', (q) => q.eq('projectId', p._id))
          .collect()
      )
    );

    const generationTasks = await Promise.all(
      projects.map((p) =>
        ctx.db
          .query('generationTasks')
          .withIndex('by_project_phase', (q) => q.eq('projectId', p._id))
          .collect()
      )
    );

    const allPhases = phases.flat();
    const allArtifacts = artifacts.flat();
    const allTasks = generationTasks.flat();

    const recentTasks = allTasks.filter((t) => t.updatedAt >= periodStart);

    const tokensUsed = recentTasks.reduce((sum, task) => {
      const taskTokens = task.plan.reduce((s, p) => {
        if ('tokens' in p) return s + (p as { tokens?: number }).tokens!;
        return s;
      }, 0);
      return sum + taskTokens;
    }, 0);

    const completedTasks = recentTasks.filter((t) => t.status === 'completed').length;
    const failedTasks = recentTasks.filter((t) => t.status === 'failed').length;
    const totalAttempts = completedTasks + failedTasks;

    const specsGenerated = recentTasks.filter(
      (t) => t.type === 'artifact' && t.status === 'completed'
    ).length;

    const phasesCompleted = allPhases.filter(
      (p) => p.status === 'ready' && p._creationTime >= periodStart
    ).length;

    const successRate = totalAttempts > 0
      ? Math.round((completedTasks / totalAttempts) * 100)
      : 100;

    return {
      tokensUsed,
      estimatedCost: calculateEstimatedCost(tokensUsed),
      specsGenerated,
      phasesCompleted,
      successRate,
      timeSavedMinutes: specsGenerated * 45,
      period,
      periodStart,
      projectCount: projects.length,
      activeProjects: projects.filter((p) => p.status === 'active').length,
      completedProjects: projects.filter((p) => p.status === 'complete').length,
    };
  },
});

export const getActivityFeed = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.id('dashboardActivity')),
  },
  handler: async (ctx: QueryCtx, args: {
    limit?: number;
    cursor?: Id<'dashboardActivity'>;
  }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { activities: [], nextCursor: null };

    const limit = args.limit ?? 20;

    let query = ctx.db
      .query('dashboardActivity')
      .withIndex('by_user_created', (q) => q.eq('userId', identity.subject))
      .order('desc');

    if (args.cursor) {
      const cursorDoc = await ctx.db.get(args.cursor);
      if (cursorDoc) {
        query = query.filter((q) => q.lt(q.field('createdAt'), cursorDoc.createdAt));
      }
    }

    const activities = await query.take(limit + 1);

    if (activities.length > limit) {
      const result = activities.slice(0, limit);
      return {
        activities: result,
        nextCursor: result[result.length - 1]._id,
      };
    }

    return { activities, nextCursor: null };
  },
});

export const searchProjects = query({
  args: {
    query: v.optional(v.string()),
    status: v.optional(v.array(v.string())),
    dateRange: v.optional(v.object({
      from: v.number(),
      to: v.number(),
    })),
    sortBy: v.optional(v.union(
      v.literal('updatedAt'),
      v.literal('createdAt'),
      v.literal('title'),
    )),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args: {
    query?: string;
    status?: string[];
    dateRange?: { from: number; to: number };
    sortBy?: 'updatedAt' | 'createdAt' | 'title';
    cursor?: number;
    limit?: number;
  }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { projects: [], total: 0, nextCursor: null };

    let projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect();

    if (args.query) {
      const searchLower = args.query.toLowerCase();
      projects = projects.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
      );
    }

    if (args.status && args.status.length > 0) {
      projects = projects.filter((p) => args.status!.includes(p.status));
    }

    if (args.dateRange) {
      projects = projects.filter(
        (p) =>
          p.updatedAt >= args.dateRange!.from &&
          p.updatedAt <= args.dateRange!.to
      );
    }

    const sortBy = args.sortBy ?? 'updatedAt';
    projects.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      const aVal = sortBy === 'updatedAt' ? a.updatedAt : a.createdAt;
      const bVal = sortBy === 'updatedAt' ? b.updatedAt : b.createdAt;
      return bVal - aVal;
    });

    const limit = args.limit ?? 20;
    const cursor = args.cursor ?? 0;
    const paginatedProjects = projects.slice(cursor, cursor + limit);

    const enrichedProjects = await Promise.all(
      paginatedProjects.map(async (project) => {
        const [phases, metrics, tags] = await Promise.all([
          ctx.db
            .query('phases')
            .withIndex('by_project', (q) => q.eq('projectId', project._id))
            .collect(),
          ctx.db
            .query('projectMetrics')
            .withIndex('by_project', (q) => q.eq('projectId', project._id))
            .unique(),
          ctx.db
            .query('projectTags')
            .withIndex('by_project', (q) => q.eq('projectId', project._id))
            .collect(),
        ]);

        const completedPhases = phases.filter((p) => p.status === 'ready').length;
        const totalPhases = phases.length;
        const completionPercentage = totalPhases > 0
          ? Math.round((completedPhases / totalPhases) * 100)
          : 0;

        const hasStalePhases = phases.some((p) => p.isStale);
        const verificationResults = await ctx.db
          .query('verificationResults')
          .withIndex('by_project', (q) => q.eq('projectId', project._id))
          .first();

        return {
          ...project,
          metrics: metrics ?? {
            projectId: project._id,
            totalPhases,
            completedPhases,
            completionPercentage,
            healthScore: 100,
            stalenessFlags: [],
            verificationStatus: verificationResults?.status ?? 'not_checked',
            lastActivityAt: project.updatedAt,
            lastActivityType: null,
            totalTokensUsed: 0,
            estimatedCost: 0,
            generationCount: completedPhases,
            updatedAt: Date.now(),
          },
          tags: tags.map((t) => t.tag),
          _computedCompletion: completionPercentage,
          _currentPhase: phases.find((p) => p.status === 'generating')?.phaseId,
          _hasStale: hasStalePhases,
        };
      })
    );

    return {
      projects: enrichedProjects,
      total: projects.length,
      nextCursor: cursor + limit < projects.length ? cursor + limit : null,
    };
  },
});

export const getProjectWithProgress = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx: QueryCtx, args: { projectId: Id<'projects'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      return null;
    }

    const [phases, metrics, tags, verificationResults] = await Promise.all([
      ctx.db
        .query('phases')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .collect(),
      ctx.db
        .query('projectMetrics')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .unique(),
      ctx.db
        .query('projectTags')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .collect(),
      ctx.db
        .query('verificationResults')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .collect(),
    ]);

    const completedPhases = phases.filter((p) => p.status === 'ready').length;
    const totalPhases = phases.length;
    const completionPercentage = totalPhases > 0
      ? Math.round((completedPhases / totalPhases) * 100)
      : 0;

    return {
      project,
      phases,
      metrics: metrics ?? {
        projectId: project._id,
        totalPhases,
        completedPhases,
        completionPercentage,
        healthScore: 100,
        stalenessFlags: [],
        verificationStatus: verificationResults[0]?.status ?? 'not_checked',
        lastActivityAt: project.updatedAt,
        lastActivityType: null,
        totalTokensUsed: 0,
        estimatedCost: 0,
        generationCount: completedPhases,
        updatedAt: Date.now(),
      },
      tags: tags.map((t) => t.tag),
      verificationResults,
      completionPercentage,
      currentPhase: phases.find((p) => p.status === 'generating') ?? null,
      hasStalePhases: phases.some((p) => p.isStale),
    };
  },
});

export const getRecentProjects = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args: { limit?: number }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const limit = args.limit ?? 5;

    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect();

    const recent = projects
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

    const enriched = await Promise.all(
      recent.map(async (project) => {
        const phases = await ctx.db
          .query('phases')
          .withIndex('by_project', (q) => q.eq('projectId', project._id))
          .collect();

        const completedPhases = phases.filter((p) => p.status === 'ready').length;
        const totalPhases = phases.length;
        const completionPercentage = totalPhases > 0
          ? Math.round((completedPhases / totalPhases) * 100)
          : 0;

        return {
          ...project,
          completionPercentage,
          currentPhase: phases.find((p) => p.status === 'generating')?.phaseId,
        };
      })
    );

    return enriched;
  },
});
