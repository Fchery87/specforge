'use node';

/**
 * Provider Configuration Actions
 * 
 * Manages provider metadata from models.dev including API endpoints.
 * This enables dynamic provider support without hardcoding.
 */

import { action, internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { fetchModelDirectory, getAllModels, type ModelsDevProvider } from '../../lib/llm/model-directory';

// In-memory cache for provider data
let providerCache: {
  providers: ModelsDevProvider[];
  timestamp: number;
} | null = null;

const CACHE_DURATION_MS = 1000 * 60 * 30; // 30 minutes

async function getCachedProviders(): Promise<ModelsDevProvider[]> {
  if (providerCache && Date.now() - providerCache.timestamp < CACHE_DURATION_MS) {
    return providerCache.providers;
  }
  
  const providers = await fetchModelDirectory();
  providerCache = { providers, timestamp: Date.now() };
  return providers;
}

/**
 * Get provider API endpoint
 */
export const getProviderApiEndpoint = action({
  args: {
    providerId: v.string(),
  },
  handler: async (_ctx, args) => {
    const providers = await getCachedProviders();
    const provider = providers.find(p => p.id === args.providerId);
    
    if (!provider) {
      return null;
    }
    
    return {
      id: provider.id,
      name: provider.name,
      api: provider.api || null,
      npm: provider.npm,
      doc: provider.doc,
      env: provider.env,
    };
  },
});

/**
 * Get all providers with their API endpoints
 */
export const getAllProviderEndpoints = action({
  args: {},
  handler: async (_ctx) => {
    const providers = await getCachedProviders();
    
    return providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      api: provider.api || null,
      npm: provider.npm,
      doc: provider.doc,
      env: provider.env,
      hasApi: !!provider.api,
      isOpenAiCompatible: provider.api?.includes('/v1') || false,
    }));
  },
});

/**
 * Check if a provider is supported
 */
export const isProviderSupported = action({
  args: {
    providerId: v.string(),
  },
  handler: async (_ctx, args) => {
    const providers = await getCachedProviders();
    const provider = providers.find(p => p.id === args.providerId);
    
    if (!provider) {
      return { supported: false, reason: 'Provider not found' };
    }
    
    // Check if provider has an API endpoint or is in our known list
    const hasApi = !!provider.api;
    const knownProviders = ['openai', 'anthropic', 'deepseek', 'mistral', 'openrouter', 'zai', 'minimax', 'groq', 'together', 'fireworks', 'nvidia', 'chutes', 'replicate', 'ai21', 'cohere', 'azure', 'google'];
    const isKnown = knownProviders.includes(provider.id);
    
    if (hasApi || isKnown) {
      return { 
        supported: true, 
        api: provider.api,
        npm: provider.npm,
      };
    }
    
    return { 
      supported: false, 
      reason: 'No API endpoint configured for this provider',
      npm: provider.npm,
    };
  },
});

/**
 * Refresh provider cache
 */
export const refreshProviderCache = internalAction({
  args: {},
  handler: async (_ctx) => {
    providerCache = null;
    const providers = await fetchModelDirectory();
    providerCache = { providers, timestamp: Date.now() };
    
    return {
      success: true,
      providerCount: providers.length,
      withApi: providers.filter(p => p.api).length,
    };
  },
});
