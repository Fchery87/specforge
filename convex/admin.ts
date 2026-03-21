import { mutation, query, internalQuery } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { internal as internalApi } from './_generated/api';
import { requireAdmin } from './lib/auth';

export const debugIdentity = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { error: 'Not authenticated' };
    }
    // Return the raw identity object keys to see what's available
    return {
      identityKeys: Object.keys(identity),
      identityValues: identity,
    };
  },
});

// Admin check - now using proper JWT metadata claim
export const getSystemStats = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx);

    const projects = await ctx.db.query('projects').collect();
    const artifacts = await ctx.db.query('artifacts').collect();
    const users = await ctx.db.query('userLlmConfigs').collect();

    return {
      totalProjects: projects.length,
      totalArtifacts: artifacts.length,
      totalUsersWithConfig: users.length,
      projectsByStatus: {
        draft: projects.filter((p) => p.status === 'draft').length,
        active: projects.filter((p) => p.status === 'active').length,
        complete: projects.filter((p) => p.status === 'complete').length,
      },
    };
  },
});

export const listAllModels = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx);

    return await ctx.db.query('llmModels').collect();
  },
});

export const addModel = mutation({
  args: {
    provider: v.string(),
    modelId: v.string(),
    contextTokens: v.number(),
    maxOutputTokens: v.number(),
    defaultMax: v.number(),
    enabled: v.boolean(),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);

    return await ctx.db.insert('llmModels', args);
  },
});

export const updateModel = mutation({
  args: {
    modelId: v.string(),
    updates: v.object({
      contextTokens: v.optional(v.number()),
      maxOutputTokens: v.optional(v.number()),
      defaultMax: v.optional(v.number()),
      enabled: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query('llmModels')
      .withIndex('by_model', (q) => q.eq('modelId', args.modelId))
      .first();

    if (!existing) throw new Error('Model not found');

    await ctx.db.patch(existing._id, args.updates);
    return existing._id;
  },
});

export const deleteModel = mutation({
  args: { modelId: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query('llmModels')
      .withIndex('by_model', (q) => q.eq('modelId', args.modelId))
      .first();

    if (!existing) throw new Error('Model not found');

    await ctx.db.delete(existing._id);
  },
});

// System credentials management for admins
// Admin-only: global LLM configuration for shared system credentials.
// Non-admins must never access these models or credentials.
export const listSystemCredentials = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx);

    return await ctx.db.query('systemCredentials').collect();
  },
});

export const getSystemCredential = query({
  args: { provider: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx);

    const config = await ctx.db
      .query('systemCredentials')
      .withIndex('by_provider', (q) => q.eq('provider', args.provider))
      .first();

    if (!config) return null;

    return {
      provider: config.provider,
      isEnabled: config.isEnabled,
      hasApiKey: !!config.apiKey,
      zaiEndpointType: config.zaiEndpointType,
      zaiIsChina: config.zaiIsChina,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  },
});

export const deleteSystemCredential = mutation({
  args: { provider: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query('systemCredentials')
      .withIndex('by_provider', (q) => q.eq('provider', args.provider))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Get recent activity from generation tasks for monitoring
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;
    const tasks = await ctx.db.query('generationTasks').collect();
    
    // Extract activity logs from all tasks and flatten
    const activities: Array<{
      id: string;
      timestamp: number;
      message: string;
      type: 'info' | 'context' | 'generating' | 'complete';
      projectId: string;
      phaseId: string;
      taskStatus: string;
    }> = [];

    for (const task of tasks) {
      if (task.activityLog && task.activityLog.length > 0) {
        for (const log of task.activityLog) {
          activities.push({
            id: `${task._id}-${log.timestamp}`,
            timestamp: log.timestamp,
            message: log.message,
            type: log.type,
            projectId: task.projectId,
            phaseId: task.phaseId,
            taskStatus: task.status,
          });
        }
      }
    }

    // Sort by timestamp descending and limit
    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, limit);
  },
});

// ==================== USER MANAGEMENT ====================

export const listAllUsers = query({
  args: {
    search: v.optional(v.string()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;
    const userConfigs = await ctx.db.query('userLlmConfigs').collect();
    
    // Get unique user IDs
    const userIds = [...new Set(userConfigs.map(u => u.userId))];
    
    // Build user stats
    const users = await Promise.all(
      userIds.map(async (userId) => {
        const configs = userConfigs.filter(u => u.userId === userId);
        const projects = await ctx.db
          .query('projects')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .collect();
        
        const artifacts = await Promise.all(
          projects.map(async (p) => {
            const arts = await ctx.db
              .query('artifacts')
              .withIndex('by_project', (q) => q.eq('projectId', p._id))
              .collect();
            return arts.length;
          })
        );

        return {
          userId,
          configs: configs.map(c => ({
            provider: c.provider,
            defaultModel: c.defaultModel,
            useSystem: c.useSystem,
          })),
          projectCount: projects.length,
          artifactCount: artifacts.reduce((a, b) => a + b, 0),
          lastActive: projects.length > 0 
            ? Math.max(...projects.map(p => p.updatedAt))
            : null,
        };
      })
    );

    // Filter by search if provided
    let filteredUsers = users;
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filteredUsers = users.filter(u => 
        u.userId.toLowerCase().includes(searchLower) ||
        u.configs.some(c => c.provider.toLowerCase().includes(searchLower))
      );
    }

    // Sort by last active (nulls last)
    filteredUsers.sort((a, b) => {
      if (!a.lastActive && !b.lastActive) return 0;
      if (!a.lastActive) return 1;
      if (!b.lastActive) return -1;
      return b.lastActive - a.lastActive;
    });

    return filteredUsers.slice(0, limit);
  },
});

export const getUserDetails = query({
  args: { userId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx);

    const projects = await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    const configs = await ctx.db
      .query('userLlmConfigs')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    const recentActivity = await ctx.db
      .query('auditLogs')
      .withIndex('by_actor', (q) => q.eq('actorId', args.userId))
      .order('desc')
      .take(20);

    return {
      userId: args.userId,
      projects: projects.map(p => ({
        id: p._id,
        title: p.title,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      configs: configs.map(c => ({
        provider: c.provider,
        defaultModel: c.defaultModel,
        useSystem: c.useSystem,
      })),
      recentActivity: recentActivity.map(a => ({
        action: a.action,
        targetType: a.targetType,
        createdAt: a.createdAt,
        details: a.details,
      })),
    };
  },
});

export const suspendUser = mutation({
  args: { 
    userId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    
    // Log the action
    await ctx.db.insert('auditLogs', {
      action: 'user_suspended',
      actorId: identity?.subject ?? 'system',
      targetType: 'user',
      targetId: args.userId,
      details: args.reason,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ==================== PROJECT MANAGEMENT ====================

export const listAllProjects = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.union(v.literal('draft'), v.literal('active'), v.literal('complete'))),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;
    let projects = await ctx.db.query('projects').collect();

    // Apply filters
    if (args.status) {
      projects = projects.filter(p => p.status === args.status);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      projects = projects.filter(p => 
        p.title.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort by updatedAt desc
    projects.sort((a, b) => b.updatedAt - a.updatedAt);

    return projects.slice(0, limit).map(p => ({
      id: p._id,
      userId: p.userId,
      title: p.title,
      description: p.description,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  },
});

export const deleteProjectAsAdmin = mutation({
  args: { 
    projectId: v.id('projects'),
    reason: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error('Project not found');

    // Delete related data
    const phases = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    
    for (const phase of phases) {
      await ctx.db.delete(phase._id);
    }

    const artifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    
    for (const artifact of artifacts) {
      await ctx.db.delete(artifact._id);
    }

    await ctx.db.delete(args.projectId);

    // Log the action
    await ctx.db.insert('auditLogs', {
      action: 'project_deleted',
      actorId: identity?.subject ?? 'system',
      targetType: 'project',
      targetId: args.projectId,
      details: args.reason,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const bulkDeleteProjects = mutation({
  args: { 
    projectIds: v.array(v.id('projects')),
    reason: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    let deletedCount = 0;
    for (const projectId of args.projectIds) {
      const project = await ctx.db.get(projectId);
      if (!project) continue;

      // Delete phases
      const phases = await ctx.db
        .query('phases')
        .withIndex('by_project', (q) => q.eq('projectId', projectId))
        .collect();
      for (const phase of phases) {
        await ctx.db.delete(phase._id);
      }

      // Delete artifacts
      const artifacts = await ctx.db
        .query('artifacts')
        .withIndex('by_project', (q) => q.eq('projectId', projectId))
        .collect();
      for (const artifact of artifacts) {
        await ctx.db.delete(artifact._id);
      }

      await ctx.db.delete(projectId);
      deletedCount++;
    }

    // Log the action
    await ctx.db.insert('auditLogs', {
      action: 'projects_bulk_deleted',
      actorId: identity?.subject ?? 'system',
      targetType: 'project',
      details: JSON.stringify({ count: deletedCount, reason: args.reason }),
      createdAt: Date.now(),
    });

    return { deletedCount };
  },
});

// ==================== ANALYTICS & USAGE ====================

export const getUsageAnalytics = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx);

    const days = args.days ?? 30;
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get all generation tasks in the timeframe
    const tasks = await ctx.db.query('generationTasks').collect();
    const recentTasks = tasks.filter(t => t.updatedAt > cutoffTime);

    // Calculate token usage by provider
    const providerUsage: Record<string, { tokens: number; cost: number; tasks: number }> = {};
    const modelUsage: Record<string, { tokens: number; tasks: number }> = {};
    const dailyUsage: Record<string, { tokens: number; tasks: number }> = {};

    for (const task of recentTasks) {
      const provider = task.metadata.credentials.provider;
      const modelId = task.metadata.model.id;
      const date = new Date(task.updatedAt).toISOString().split('T')[0];

      // Estimate tokens from sections
      const tokens = task.plan.reduce((sum: number, section: any) => sum + (section.maxTokens || 0), 0);

      // Provider stats
      if (!providerUsage[provider]) {
        providerUsage[provider] = { tokens: 0, cost: 0, tasks: 0 };
      }
      providerUsage[provider].tokens += tokens;
      providerUsage[provider].tasks += 1;
      // Rough cost estimation (would need actual pricing)
      providerUsage[provider].cost += (tokens / 1000) * 0.01;

      // Model stats
      if (!modelUsage[modelId]) {
        modelUsage[modelId] = { tokens: 0, tasks: 0 };
      }
      modelUsage[modelId].tokens += tokens;
      modelUsage[modelId].tasks += 1;

      // Daily stats
      if (!dailyUsage[date]) {
        dailyUsage[date] = { tokens: 0, tasks: 0 };
      }
      dailyUsage[date].tokens += tokens;
      dailyUsage[date].tasks += 1;
    }

    // Calculate success rates
    const completedTasks = recentTasks.filter(t => t.status === 'completed').length;
    const failedTasks = recentTasks.filter(t => t.status === 'failed').length;
    const inProgressTasks = recentTasks.filter(t => t.status === 'in_progress').length;

    // Top users by activity
    const userActivity: Record<string, { projects: number; tasks: number }> = {};
    for (const task of recentTasks) {
      const project = await ctx.db.get(task.projectId);
      if (!project) continue;
      
      const userId = project.userId;
      if (!userActivity[userId]) {
        userActivity[userId] = { projects: 0, tasks: 0 };
      }
      userActivity[userId].tasks += 1;
    }

    // Count unique projects per user
    const projects = await ctx.db.query('projects').collect();
    for (const project of projects) {
      if (!userActivity[project.userId]) {
        userActivity[project.userId] = { projects: 0, tasks: 0 };
      }
      userActivity[project.userId].projects += 1;
    }

    const topUsers = Object.entries(userActivity)
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.tasks - a.tasks)
      .slice(0, 10);

    return {
      period: { days, startTime: cutoffTime },
      summary: {
        totalTasks: recentTasks.length,
        completedTasks,
        failedTasks,
        inProgressTasks,
        successRate: recentTasks.length > 0 ? (completedTasks / recentTasks.length) * 100 : 0,
        totalTokens: Object.values(providerUsage).reduce((sum, p) => sum + p.tokens, 0),
        estimatedCost: Object.values(providerUsage).reduce((sum, p) => sum + p.cost, 0),
      },
      providerUsage,
      modelUsage,
      dailyUsage,
      topUsers,
    };
  },
});

// ==================== SYSTEM HEALTH ====================

export const getHealthStatus = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx);

    // Get current health checks
    const healthChecks = await ctx.db.query('healthChecks').collect();

    // Get generation task queue status
    const tasks = await ctx.db.query('generationTasks').collect();
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const queuedTasks = tasks.filter(t => t.status === 'in_progress' && !t.activityLog).length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;

    // Calculate error rate (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentTasks = tasks.filter(t => t.updatedAt > oneDayAgo);
    const recentFailed = recentTasks.filter(t => t.status === 'failed').length;
    const errorRate = recentTasks.length > 0 ? (recentFailed / recentTasks.length) * 100 : 0;

    // Get storage usage (approximate)
    const projects = await ctx.db.query('projects').collect();
    const artifacts = await ctx.db.query('artifacts').collect();

    return {
      providers: healthChecks.map(h => ({
        provider: h.provider,
        status: h.status,
        responseTime: h.responseTime,
        lastChecked: h.lastChecked,
        consecutiveFailures: h.consecutiveFailures,
      })),
      queue: {
        inProgress: inProgressTasks,
        queued: queuedTasks,
        failed: failedTasks,
      },
      errorRate: {
        percentage: errorRate,
        recentFailed,
        recentTotal: recentTasks.length,
      },
      storage: {
        projects: projects.length,
        artifacts: artifacts.length,
        estimatedTokens: artifacts.reduce((sum, a) => sum + a.content.length, 0) / 4, // Rough estimate
      },
    };
  },
});

export const checkProviderHealth = mutation({
  args: { provider: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);

    // Get credentials for the provider
    const credential = await ctx.db
      .query('systemCredentials')
      .withIndex('by_provider', (q) => q.eq('provider', args.provider))
      .first();

    if (!credential || !credential.isEnabled) {
      throw new Error(`Provider ${args.provider} not configured or disabled`);
    }

    // Perform health check (simplified - in production would make actual API call)
    const startTime = Date.now();
    
    // Simulate health check (would be replaced with actual API ping)
    const isHealthy = Math.random() > 0.1; // 90% success rate for demo
    const responseTime = Date.now() - startTime + Math.random() * 500;

    const status = isHealthy ? 'healthy' : 'degraded';

    // Update or create health check record
    const existing = await ctx.db
      .query('healthChecks')
      .withIndex('by_provider', (q) => q.eq('provider', args.provider))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status,
        responseTime,
        lastChecked: Date.now(),
        consecutiveFailures: isHealthy ? 0 : existing.consecutiveFailures + 1,
      });
    } else {
      await ctx.db.insert('healthChecks', {
        provider: args.provider,
        status,
        responseTime,
        lastChecked: Date.now(),
        consecutiveFailures: isHealthy ? 0 : 1,
      });
    }

    return { status, responseTime };
  },
});

// ==================== SECURITY & AUDIT ====================

export const getAuditLogs = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
    action: v.optional(v.string()),
    targetType: v.optional(v.union(
      v.literal('user'),
      v.literal('project'),
      v.literal('credential'),
      v.literal('system'),
      v.literal('model'),
    )),
  },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 100;
    let logs = await ctx.db.query('auditLogs').collect();

    // Apply filters
    if (args.action) {
      logs = logs.filter(l => l.action === args.action);
    }
    if (args.targetType) {
      logs = logs.filter(l => l.targetType === args.targetType);
    }

    // Sort by createdAt desc
    logs.sort((a, b) => b.createdAt - a.createdAt);

    // Apply cursor pagination
    if (args.cursor) {
      logs = logs.filter(l => l.createdAt < args.cursor!);
    }

    return logs.slice(0, limit).map(l => ({
      id: l._id,
      action: l.action,
      actorId: l.actorId,
      actorEmail: l.actorEmail,
      targetType: l.targetType,
      targetId: l.targetId,
      details: l.details,
      createdAt: l.createdAt,
    }));
  },
});

export const createAuditLog = mutation({
  args: {
    action: v.string(),
    targetType: v.union(
      v.literal('user'),
      v.literal('project'),
      v.literal('credential'),
      v.literal('system'),
      v.literal('model'),
    ),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    await ctx.db.insert('auditLogs', {
      action: args.action,
      actorId: identity?.subject ?? 'system',
      targetType: args.targetType,
      targetId: args.targetId,
      details: args.details,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ==================== SYSTEM CONFIGURATION ====================

export const getFeatureFlags = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx);

    const flags = await ctx.db.query('featureFlags').collect();
    return flags.map(f => ({
      id: f._id,
      key: f.key,
      name: f.name,
      description: f.description,
      enabled: f.enabled,
      updatedAt: f.updatedAt,
    }));
  },
});

export const updateFeatureFlag = mutation({
  args: {
    key: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    const existing = await ctx.db
      .query('featureFlags')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        updatedBy: identity?.subject ?? 'system',
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('featureFlags', {
        key: args.key,
        name: args.key,
        description: '',
        enabled: args.enabled,
        updatedBy: identity?.subject ?? 'system',
        updatedAt: Date.now(),
      });
    }

    // Log the action
    await ctx.db.insert('auditLogs', {
      action: 'feature_flag_updated',
      actorId: identity?.subject ?? 'system',
      targetType: 'system',
      details: JSON.stringify({ key: args.key, enabled: args.enabled }),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const getSystemConfig = query({
  args: {
    category: v.optional(v.union(
      v.literal('rate_limit'),
      v.literal('security'),
      v.literal('generation'),
      v.literal('maintenance'),
    )),
  },
  handler: async (ctx: QueryCtx, args) => {
    await requireAdmin(ctx);

    let configs = await ctx.db.query('systemConfig').collect();

    if (args.category) {
      configs = configs.filter(c => c.category === args.category);
    }

    return configs.map(c => ({
      id: c._id,
      key: c.key,
      value: c.value,
      category: c.category,
      updatedAt: c.updatedAt,
    }));
  },
});

export const updateSystemConfig = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    category: v.union(
      v.literal('rate_limit'),
      v.literal('security'),
      v.literal('generation'),
      v.literal('maintenance'),
    ),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    const existing = await ctx.db
      .query('systemConfig')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedBy: identity?.subject ?? 'system',
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('systemConfig', {
        key: args.key,
        value: args.value,
        category: args.category,
        updatedBy: identity?.subject ?? 'system',
        updatedAt: Date.now(),
      });
    }

    // Log the action
    await ctx.db.insert('auditLogs', {
      action: 'system_config_updated',
      actorId: identity?.subject ?? 'system',
      targetType: 'system',
      details: JSON.stringify({ key: args.key, category: args.category }),
      createdAt: Date.now(),
    });

    return { success: true };
  },
});
