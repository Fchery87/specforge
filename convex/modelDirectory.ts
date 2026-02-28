import { query, mutation, internalQuery, internalMutation } from './_generated/server';
import { v } from 'convex/values';

/**
 * Model Directory Cache Management
 *
 * Internal queries and mutations for managing the models.dev cache
 */

/**
 * Get a cache entry by key
 */
export const getCacheEntry = internalQuery({
  args: {
    cacheKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('modelDirectoryCache')
      .withIndex('by_key', (q) => q.eq('cacheKey', args.cacheKey))
      .first();
  },
});

/**
 * Set a cache entry (insert or update)
 */
export const setCacheEntry = internalMutation({
  args: {
    cacheKey: v.string(),
    data: v.any(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('modelDirectoryCache')
      .withIndex('by_key', (q) => q.eq('cacheKey', args.cacheKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.data,
        fetchedAt: Date.now(),
        expiresAt: args.expiresAt,
        version: (existing.version || 0) + 1,
      });
      return existing._id;
    } else {
      return await ctx.db.insert('modelDirectoryCache', {
        cacheKey: args.cacheKey,
        data: args.data,
        fetchedAt: Date.now(),
        expiresAt: args.expiresAt,
        version: 1,
      });
    }
  },
});

/**
 * Delete a cache entry
 */
export const deleteCacheEntry = internalMutation({
  args: {
    cacheKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('modelDirectoryCache')
      .withIndex('by_key', (q) => q.eq('cacheKey', args.cacheKey))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Clear all cache entries
 */
export const clearAllCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('modelDirectoryCache').collect();
    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
    return entries.length;
  },
});

/**
 * Get cache statistics
 */
export const getCacheStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('modelDirectoryCache').collect();
    const now = Date.now();

    return {
      totalEntries: entries.length,
      expiredEntries: entries.filter((e) => e.expiresAt < now).length,
      validEntries: entries.filter((e) => e.expiresAt >= now).length,
      entries: entries.map((e) => ({
        cacheKey: e.cacheKey,
        fetchedAt: e.fetchedAt,
        expiresAt: e.expiresAt,
        version: e.version,
        isExpired: e.expiresAt < now,
      })),
    };
  },
});
