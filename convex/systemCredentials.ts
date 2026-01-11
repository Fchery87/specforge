import { mutation, query, internalQuery } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';

// Raw query that returns encrypted data without decrypting
export const getSystemCredentialRaw = query({
  args: { provider: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // In production, check for admin role here
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.log('[getAllSystemCredentials] No identity, returning null');
      return null;
    }

    const credentials = await ctx.db.query('systemCredentials').collect();
    console.log('[getAllSystemCredentials] Found credentials count:', credentials.length);
    credentials.forEach(c => {
      console.log('[getAllSystemCredentials] - Provider:', c.provider, 'isEnabled:', c.isEnabled, 'hasApiKey:', !!c.apiKey);
    });
    return credentials;
  },
});

// Internal query for getting all system credentials (for use in internal actions)
export const getAllSystemCredentialsInternal = internalQuery({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const credentials = await ctx.db.query('systemCredentials').collect();
    console.log('[getAllSystemCredentialsInternal] Found credentials count:', credentials.length);
    credentials.forEach(c => {
      console.log('[getAllSystemCredentialsInternal] - Provider:', c.provider, 'isEnabled:', c.isEnabled, 'hasApiKey:', !!c.apiKey);
    });
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    // In production, check for admin role here

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

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
