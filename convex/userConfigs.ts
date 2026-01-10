import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';

// Raw query that returns encrypted data without decrypting
export const getUserConfigRaw = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const config = await ctx.db
      .query('userLlmConfigs')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .first();

    if (!config) return null;

    return {
      userId: config.userId,
      provider: config.provider,
      apiKey: config.apiKey,
      defaultModel: config.defaultModel,
      useSystem: config.useSystem,
    };
  },
});

// Raw mutation that saves encrypted data
export const saveUserConfigRaw = mutation({
  args: {
    provider: v.string(),
    encryptedApiKey: v.union(v.null(), v.array(v.number())),
    defaultModel: v.string(),
    useSystem: v.boolean(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    let apiKeyBuffer: ArrayBuffer | undefined;
    if (args.encryptedApiKey) {
      apiKeyBuffer = new Uint8Array(args.encryptedApiKey).buffer;
    }

    const existing = await ctx.db
      .query('userLlmConfigs')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        ...(apiKeyBuffer !== undefined && { apiKey: apiKeyBuffer }),
        defaultModel: args.defaultModel,
        useSystem: args.useSystem,
      });
      return existing._id;
    } else {
      return await ctx.db.insert('userLlmConfigs', {
        userId: identity.subject,
        provider: args.provider,
        apiKey: apiKeyBuffer,
        defaultModel: args.defaultModel,
        useSystem: args.useSystem,
      });
    }
  },
});

// Raw mutation for deletion
export const deleteUserConfigRaw = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const existing = await ctx.db
      .query('userLlmConfigs')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .first();

    if (existing && existing.apiKey) {
      await ctx.db.delete(existing._id);
    }
  },
});
