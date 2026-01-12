import { mutation, query, internalQuery } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { requireAdmin } from './lib/auth';

// Raw query that returns encrypted data without decrypting
export const getSystemCredentialRaw = query({
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
      apiKey: config.apiKey,
      isEnabled: config.isEnabled,
      zaiEndpointType: config.zaiEndpointType,
      zaiIsChina: config.zaiIsChina,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  },
});

// Get all system credentials (without decrypting keys)
export const getAllSystemCredentials = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    await requireAdmin(ctx);

    const credentials = await ctx.db.query('systemCredentials').collect();
    return credentials;
  },
});

// Internal query for getting all system credentials (for use in internal actions)
// NOTE: No auth check needed - internal queries are server-to-server only
export const getAllSystemCredentialsInternal = internalQuery({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const credentials = await ctx.db.query('systemCredentials').collect();
    return credentials;
  },
});

// Set or update system credential for a provider (raw mutation - accepts pre-encrypted data)
export const setSystemCredentialRaw = mutation({
  args: {
    provider: v.string(),
    encryptedApiKey: v.union(v.null(), v.array(v.number())),
    isEnabled: v.boolean(),
    zaiEndpointType: v.optional(
      v.union(v.literal('paid'), v.literal('coding'))
    ),
    zaiIsChina: v.optional(v.boolean()),
  },
  handler: async (ctx: MutationCtx, args) => {
    await requireAdmin(ctx);

    let apiKeyBuffer: ArrayBuffer | undefined;
    if (args.encryptedApiKey) {
      apiKeyBuffer = new Uint8Array(args.encryptedApiKey).buffer;
    }

    const now = Date.now();

    // Check if credential already exists
    const existing = await ctx.db
      .query('systemCredentials')
      .withIndex('by_provider', (q) => q.eq('provider', args.provider))
      .first();

    if (existing) {
      // Update existing credential
      const updates: any = {
        isEnabled: args.isEnabled,
        zaiEndpointType: args.zaiEndpointType,
        zaiIsChina: args.zaiIsChina,
        updatedAt: now,
      };

      if (apiKeyBuffer !== undefined) {
        updates.apiKey = apiKeyBuffer;
      }

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      // Create new credential
      return await ctx.db.insert('systemCredentials', {
        provider: args.provider,
        apiKey: apiKeyBuffer,
        isEnabled: args.isEnabled,
        zaiEndpointType: args.zaiEndpointType,
        zaiIsChina: args.zaiIsChina,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Delete system credential (raw mutation)
export const deleteSystemCredentialRaw = mutation({
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

// NOTE: Decryption must be done in actions with "use node" directive.
// Use getAllDecryptedSystemCredentials from internalActions.ts action instead.
