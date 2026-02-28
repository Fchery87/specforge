'use node';

/**
 * Cron job handlers for scheduled tasks
 *
 * These actions are triggered by the cron scheduler defined in crons.ts
 * 
 * NOTE: These are action wrappers that delegate to internal.ts mutations/queries
 * because internalAction cannot directly access ctx.db - it must use runQuery/runMutation.
 */

import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { fetchModelDirectory } from '../lib/llm/model-directory';

/**
 * Refresh the models.dev cache in the database
 * Triggered daily at 3 AM UTC
 */
export const refreshModelDirectoryCache = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log('[cron] Starting daily models.dev cache refresh...');
    const startedAt = Date.now();

    try {
      // Fetch fresh data from models.dev
      const providers = await fetchModelDirectory();

      // Store in database cache via internal mutation
      await ctx.runMutation(internal.internal.setModelDirectoryCache, {
        cacheKey: 'providers',
        data: providers,
        expiresAt: startedAt + 24 * 60 * 60 * 1000, // 24 hours
      });

      // Also cache individual provider data for faster lookups (top 20 providers)
      for (const provider of providers.slice(0, 20)) {
        await ctx.runMutation(internal.internal.setModelDirectoryCache, {
          cacheKey: `provider:${provider.id}`,
          data: provider,
          expiresAt: startedAt + 24 * 60 * 60 * 1000,
        });
      }

      const durationMs = Date.now() - startedAt;
      const totalModels = providers.reduce(
        (sum, p) => sum + Object.keys(p.models).length,
        0
      );

      console.log(
        `[cron] Successfully refreshed models.dev cache: ${providers.length} providers, ${totalModels} models in ${durationMs}ms`
      );

      return {
        success: true,
        providerCount: providers.length,
        modelCount: totalModels,
        durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[cron] Failed to refresh models.dev cache:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Cleanup old artifact versions to control storage
 * Triggered weekly on Sundays at 4 AM UTC
 * Retention policy: keep last 10 versions per artifact
 */
export const cleanupOldArtifactVersions = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log('[cron] Starting weekly artifact version cleanup...');
    const startedAt = Date.now();

    try {
      // Get all artifacts via internal query
      const allArtifacts = await ctx.runQuery(internal.internal.getAllArtifacts, {});
      let totalDeleted = 0;
      let artifactsProcessed = 0;

      for (const artifact of allArtifacts) {
        // Get versions for this artifact
        const versions = await ctx.runQuery(internal.internal.getArtifactVersions, {
          artifactId: artifact._id,
        });

        // Keep only the last 10 versions
        const versionsToDelete = versions.slice(10);

        for (const version of versionsToDelete) {
          await ctx.runMutation(internal.internal.deleteArtifactVersion, {
            versionId: version._id,
          });
          totalDeleted++;
        }

        if (versions.length > 0) {
          artifactsProcessed++;
        }
      }

      const durationMs = Date.now() - startedAt;
      console.log(
        `[cron] Artifact version cleanup complete: ${totalDeleted} versions deleted from ${artifactsProcessed} artifacts in ${durationMs}ms`
      );

      return {
        success: true,
        versionsDeleted: totalDeleted,
        artifactsProcessed,
        durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[cron] Failed to cleanup artifact versions:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
