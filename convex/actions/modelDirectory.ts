'use node';

/**
 * Models.dev Integration Actions
 *
 * Provides Convex actions for fetching and caching AI model data
 * from models.dev API. Used by the frontend for dynamic model selection.
 */

import { action, internalAction } from '../_generated/server';
import { v } from 'convex/values';
import {
  fetchModelDirectory,
  getAllModels,
  getModelsByProvider,
  getSpecGenerationModels,
  getRecommendedModels as fetchRecommendedModels,
  getModelById,
  convertToSpecForgeModel,
  formatCost,
  formatTokenLimit,
  type ModelsDevProvider,
  type ModelsDevModel,
} from '../../lib/llm/model-directory';

// Simple in-memory cache for Convex actions (per-invocation only)
// For persistent caching, consider using Convex's built-in caching or external cache
let actionCache: {
  data: ModelsDevProvider[];
  timestamp: number;
} | null = null;

const CACHE_DURATION_MS = 1000 * 60 * 30; // 30 minutes

/**
 * Helper to get cached or fresh data
 */
async function getCachedOrFresh(): Promise<ModelsDevProvider[]> {
  if (actionCache && Date.now() - actionCache.timestamp < CACHE_DURATION_MS) {
    return actionCache.data;
  }

  const data = await fetchModelDirectory();
  actionCache = { data, timestamp: Date.now() };
  return data;
}

/**
 * Get all available providers from models.dev
 */
export const getProviders = action({
  args: {},
  handler: async (_ctx) => {
    const providers = await getCachedOrFresh();

    return providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      npm: provider.npm,
      env: provider.env,
      doc: provider.doc,
      api: provider.api,
      modelCount: Object.keys(provider.models).length,
      requiresApiKey: provider.env.length > 0,
      primaryEnvVar: provider.env[0] || null,
    }));
  },
});

/**
 * Get all models (optionally filtered by provider)
 */
export const getModels = action({
  args: {
    providerId: v.optional(v.string()),
    suitableForSpecs: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    let models: Array<{
      provider: ModelsDevProvider;
      model: ModelsDevModel;
    }>;

    if (args.suitableForSpecs) {
      models = await getSpecGenerationModels();
    } else if (args.providerId) {
      const providerModels = await getModelsByProvider(args.providerId);
      const providers = await getCachedOrFresh();
      const provider = providers.find((p) => p.id === args.providerId);

      if (!provider) {
        return [];
      }

      models = providerModels.map((model) => ({ provider, model }));
    } else {
      models = await getAllModels();
    }

    return models.map(({ provider, model }) => ({
      ...convertToSpecForgeModel(provider, model),
      formattedCost: {
        input: formatCost(model.cost?.input ?? 0),
        output: formatCost(model.cost?.output ?? 0),
      },
      formattedLimits: {
        context: formatTokenLimit(model.limit?.context ?? 0),
        output: formatTokenLimit(model.limit?.output ?? 0),
      },
    }));
  },
});

/**
 * Get recommended models for spec generation
 */
export const getRecommendedModels = action({
  args: {},
  handler: async (_ctx) => {
    const models = await fetchRecommendedModels();

    return models.map(({ provider, model }: { provider: ModelsDevProvider; model: ModelsDevModel }) => ({
      ...convertToSpecForgeModel(provider, model),
      formattedCost: {
        input: formatCost(model.cost?.input ?? 0),
        output: formatCost(model.cost?.output ?? 0),
      },
      formattedLimits: {
        context: formatTokenLimit(model.limit?.context ?? 0),
        output: formatTokenLimit(model.limit?.output ?? 0),
      },
    }));
  },
});

/**
 * Get a specific model by ID
 */
export const getModel = action({
  args: {
    modelId: v.string(),
    providerId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const result = await getModelById(args.modelId, args.providerId);

    if (!result) {
      return null;
    }

    const { provider, model } = result;

    return {
      ...convertToSpecForgeModel(provider, model),
      formattedCost: {
        input: formatCost(model.cost?.input ?? 0),
        output: formatCost(model.cost?.output ?? 0),
      },
      formattedLimits: {
        context: formatTokenLimit(model.limit?.context ?? 0),
        output: formatTokenLimit(model.limit?.output ?? 0),
      },
    };
  },
});

/**
 * Search models by name or provider
 */
export const searchModels = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const allModels = await getAllModels();
    const searchTerm = args.query.toLowerCase();
    const limit = args.limit ?? 20;

    const filtered = allModels.filter(({ provider, model }) => {
      const searchableText = `${provider.name} ${model.name} ${model.id} ${provider.id}`.toLowerCase();
      return searchableText.includes(searchTerm);
    });

    return filtered.slice(0, limit).map(({ provider, model }) => ({
      ...convertToSpecForgeModel(provider, model),
      formattedCost: {
        input: formatCost(model.cost?.input ?? 0),
        output: formatCost(model.cost?.output ?? 0),
      },
      formattedLimits: {
        context: formatTokenLimit(model.limit?.context ?? 0),
        output: formatTokenLimit(model.limit?.output ?? 0),
      },
    }));
  },
});

/**
 * Get models grouped by provider
 */
export const getModelsGroupedByProvider = action({
  args: {
    suitableForSpecs: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    let models: Array<{
      provider: ModelsDevProvider;
      model: ModelsDevModel;
    }>;

    if (args.suitableForSpecs) {
      models = await getSpecGenerationModels();
    } else {
      models = await getAllModels();
    }

    // Group by provider
    const grouped = new Map<
      string,
      {
        provider: {
          id: string;
          name: string;
          npm: string;
          doc: string;
        };
        models: ReturnType<typeof convertToSpecForgeModel>[];
      }
    >();

    for (const { provider, model } of models) {
      if (!grouped.has(provider.id)) {
        grouped.set(provider.id, {
          provider: {
            id: provider.id,
            name: provider.name,
            npm: provider.npm,
            doc: provider.doc,
          },
          models: [],
        });
      }

      grouped.get(provider.id)!.models.push(
        convertToSpecForgeModel(provider, model)
      );
    }

    return Array.from(grouped.values());
  },
});

/**
 * Refresh the model directory cache (admin only)
 */
export const refreshCache = internalAction({
  args: {},
  handler: async (_ctx) => {
    actionCache = null;
    const data = await fetchModelDirectory();
    actionCache = { data, timestamp: Date.now() };
    return {
      success: true,
      providerCount: data.length,
      modelCount: data.reduce(
        (sum, p) => sum + Object.keys(p.models).length,
        0
      ),
    };
  },
});

/**
 * Get model statistics
 */
export const getStats = action({
  args: {},
  handler: async (_ctx) => {
    const providers = await getCachedOrFresh();

    let totalModels = 0;
    let activeModels = 0;
    let deprecatedModels = 0;

    for (const provider of providers) {
      for (const model of Object.values(provider.models)) {
        totalModels++;
        if (model.status === 'deprecated') {
          deprecatedModels++;
        } else {
          activeModels++;
        }
      }
    }

    return {
      providerCount: providers.length,
      totalModels,
      activeModels,
      deprecatedModels,
      cached: actionCache !== null,
      cacheAge: actionCache ? Date.now() - actionCache.timestamp : null,
    };
  },
});
