import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { internalQuery } from './_generated/server';
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
