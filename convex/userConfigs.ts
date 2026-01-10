import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { encrypt, decrypt } from "../lib/encryption";

const ENCRYPTION_KEY = process.env.CONVEX_ENCRYPTION_KEY ?? "default-dev-key-change-in-production";

export const getUserConfig = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const config = await ctx.db
      .query("userLlmConfigs")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!config) return null;

    // Decrypt the API key
    let decryptedApiKey: string | undefined;
    if (config.apiKey) {
      try {
        const encrypted = JSON.parse(Buffer.from(config.apiKey).toString("utf8"));
        decryptedApiKey = decrypt(encrypted, ENCRYPTION_KEY);
      } catch {
        // If decryption fails, return undefined
        decryptedApiKey = undefined;
      }
    }

    return {
      userId: config.userId,
      provider: config.provider,
      apiKey: decryptedApiKey,
      defaultModel: config.defaultModel,
      useSystem: config.useSystem,
    };
  },
});

export const saveUserConfig = mutation({
  args: {
    provider: v.string(),
    apiKey: v.optional(v.string()),
    defaultModel: v.string(),
    useSystem: v.boolean(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // For new configs, we need either an apiKey or useSystem to be true
    if (!args.apiKey && !args.useSystem) {
      throw new Error("Either an API key or system credential usage must be specified");
    }

    let encryptedApiKey: ArrayBuffer | null = null;
    if (args.apiKey) {
      const encrypted = encrypt(args.apiKey, ENCRYPTION_KEY);
      encryptedApiKey = Buffer.from(JSON.stringify(encrypted)).buffer;
    }

    const existing = await ctx.db
      .query("userLlmConfigs")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        ...(encryptedApiKey !== null && { apiKey: encryptedApiKey }),
        defaultModel: args.defaultModel,
        useSystem: args.useSystem,
      });
      return existing._id;
    } else {
      // For new configs, if useSystem is true but no apiKey provided, apiKey can be null
      return await ctx.db.insert("userLlmConfigs", {
        userId: identity.subject,
        provider: args.provider,
        apiKey: encryptedApiKey ?? undefined,
        defaultModel: args.defaultModel,
        useSystem: args.useSystem,
      });
    }
  },
});

export const deleteUserConfig = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("userLlmConfigs")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (existing && existing.apiKey) {
      await ctx.db.delete(existing._id);
    }
  },
});
