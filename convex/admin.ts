import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { internal as internalApi } from "./_generated/api";

export const listAllModels = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    // In production, check for admin role here
    // const publicMetadata = identity.publicMetadata as { role?: string };
    // if (publicMetadata.role !== "admin") throw new Error("Unauthorized");

    return await ctx.db.query("llmModels").collect();
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    // In production, check for admin role here
    // const publicMetadata = identity.publicMetadata as { role?: string };
    // if (publicMetadata.role !== "admin") throw new Error("Unauthorized");

    return await ctx.db.insert("llmModels", args);
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    const existing = await ctx.db
      .query("llmModels")
      .withIndex("by_model", (q) => q.eq("modelId", args.modelId))
      .first();

    if (!existing) throw new Error("Model not found");

    await ctx.db.patch(existing._id, args.updates);
    return existing._id;
  },
});

export const deleteModel = mutation({
  args: { modelId: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    const existing = await ctx.db
      .query("llmModels")
      .withIndex("by_model", (q) => q.eq("modelId", args.modelId))
      .first();

    if (!existing) throw new Error("Model not found");

    await ctx.db.delete(existing._id);
  },
});

export const getSystemStats = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const projects = await ctx.db.query("projects").collect();
    const artifacts = await ctx.db.query("artifacts").collect();
    const users = await ctx.db.query("userLlmConfigs").collect();

    return {
      totalProjects: projects.length,
      totalArtifacts: artifacts.length,
      totalUsersWithConfig: users.length,
      projectsByStatus: {
        draft: projects.filter(p => p.status === "draft").length,
        active: projects.filter(p => p.status === "active").length,
        complete: projects.filter(p => p.status === "complete").length,
      },
    };
  },
});

// Internal function to get system credentials (decrypted)
export const getAllSystemCredentialsInternal = internalQuery({
  args: {},
  handler: async (ctx: QueryCtx) => {
    return await ctx.db.query("systemCredentials").collect();
  },
});

// System credentials management for admins
export const listSystemCredentials = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // In production, check for admin role here

    return await ctx.db.query("systemCredentials").collect();
  },
});

export const getSystemCredential = query({
  args: { provider: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const config = await ctx.db
      .query("systemCredentials")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("systemCredentials")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
