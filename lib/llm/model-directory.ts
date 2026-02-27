/**
 * Models.dev Integration
 *
 * Fetches and manages AI model data from models.dev API.
 * Provides access to 75+ providers and 1000+ models with rich metadata.
 *
 * @see https://models.dev
 * @see https://github.com/anomalyco/models.dev
 */

import { fetchWithTimeout } from './response-normalizer';

const MODELS_DEV_API_URL = 'https://models.dev/api.json';
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour cache

// Models.dev Provider Schema
export interface ModelsDevProvider {
  id: string;
  name: string;
  npm: string; // AI SDK package name
  env: string[]; // Environment variable keys for auth
  doc: string; // Documentation URL
  api?: string; // OpenAI-compatible API endpoint
  models: Record<string, ModelsDevModel>;
}

// Models.dev Model Schema
export interface ModelsDevModel {
  id: string;
  name: string;
  family?: string;
  attachment: boolean;
  reasoning: boolean;
  tool_call: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  knowledge?: string; // YYYY-MM or YYYY-MM-DD
  release_date: string;
  last_updated: string;
  interleaved?: boolean | { field: string };
  cost: {
    input: number; // Cost per million tokens (USD)
    output: number; // Cost per million tokens (USD)
    cache_read?: number;
    cache_write?: number;
    output_audio?: number;
  };
  limit: {
    context: number; // Maximum context window (tokens)
    input?: number; // Maximum input tokens
    output: number; // Maximum output tokens
  };
  modalities: {
    input: Array<'text' | 'image' | 'audio' | 'video' | 'pdf'>;
    output: Array<'text' | 'image' | 'audio'>;
  };
  status?: 'active' | 'deprecated';
  open_weights?: boolean;
}

// Cache for API responses
interface CacheEntry {
  data: ModelsDevProvider[];
  timestamp: number;
}

let cache: CacheEntry | null = null;

/**
 * Fetch all providers and models from models.dev API
 */
export async function fetchModelDirectory(): Promise<ModelsDevProvider[]> {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
    return cache.data;
  }

  try {
    const response = await fetchWithTimeout(
      MODELS_DEV_API_URL,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
      30000 // 30 second timeout for initial load
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch models.dev data: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    // Transform from provider-keyed object to array
    const providers: ModelsDevProvider[] = Object.entries(data).map(
      ([id, provider]: [string, any]) => ({
        id,
        name: provider.name,
        npm: provider.npm,
        env: provider.env,
        doc: provider.doc,
        api: provider.api,
        models: provider.models,
      })
    );

    // Update cache
    cache = {
      data: providers,
      timestamp: Date.now(),
    };

    return providers;
  } catch (error) {
    console.error('Error fetching models.dev data:', error);
    // Return cached data if available, even if expired
    if (cache) {
      return cache.data;
    }
    throw error;
  }
}

/**
 * Clear the model directory cache
 */
export function clearModelDirectoryCache(): void {
  cache = null;
}

/**
 * Get all models from all providers, flattened
 */
export async function getAllModels(): Promise<
  Array<{
    provider: ModelsDevProvider;
    model: ModelsDevModel;
  }>
> {
  const providers = await fetchModelDirectory();
  const models: Array<{ provider: ModelsDevProvider; model: ModelsDevModel }> =
    [];

  for (const provider of providers) {
    for (const model of Object.values(provider.models)) {
      // Skip deprecated models
      if (model.status === 'deprecated') continue;
      models.push({ provider, model });
    }
  }

  return models;
}

/**
 * Get models filtered by provider
 */
export async function getModelsByProvider(
  providerId: string
): Promise<ModelsDevModel[]> {
  const providers = await fetchModelDirectory();
  const provider = providers.find((p) => p.id === providerId);

  if (!provider) return [];

  return Object.values(provider.models).filter(
    (m) => m.status !== 'deprecated'
  );
}

/**
 * Get a specific model by ID
 */
export async function getModelById(
  modelId: string,
  providerId?: string
): Promise<{ provider: ModelsDevProvider; model: ModelsDevModel } | null> {
  const providers = await fetchModelDirectory();

  if (providerId) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return null;

    const model = provider.models[modelId];
    if (model && model.status !== 'deprecated') {
      return { provider, model };
    }
    return null;
  }

  // Search all providers
  for (const provider of providers) {
    const model = provider.models[modelId];
    if (model && model.status !== 'deprecated') {
      return { provider, model };
    }
  }

  return null;
}

/**
 * Filter models suitable for spec generation
 * - Must support text input/output
 * - Reasonable context window (>= 32k)
 * - Reasonable output limit (>= 4k)
 * - Not deprecated
 */
export async function getSpecGenerationModels(): Promise<
  Array<{
    provider: ModelsDevProvider;
    model: ModelsDevModel;
  }>
> {
  const allModels = await getAllModels();

  return allModels.filter(({ model }) => {
    // Must support text input/output
    if (!model.modalities.input.includes('text')) return false;
    if (!model.modalities.output.includes('text')) return false;

    // Reasonable context window for spec generation
    if (model.limit.context < 32000) return false;

    // Reasonable output limit
    if (model.limit.output < 4096) return false;

    return true;
  });
}

/**
 * Get popular/recommended models for spec generation
 * Curated list of well-known models
 */
export async function getRecommendedModels(): Promise<
  Array<{
    provider: ModelsDevProvider;
    model: ModelsDevModel;
  }>
> {
  const providers = await fetchModelDirectory();
  const recommended: Array<{
    provider: ModelsDevProvider;
    model: ModelsDevModel;
  }> = [];

  // Map of provider -> recommended model IDs
  const recommendations: Record<string, string[]> = {
    anthropic: ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-4'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    mistral: ['mistral-large', 'mistral-medium', 'mistral-small'],
    openrouter: ['anthropic/claude-sonnet-4', 'openai/gpt-4o'],
    groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    zai: ['glm-4.7', 'glm-4.6', 'glm-4.5'],
    minimax: ['minimax-m2.1', 'minimax-m2'],
  };

  for (const [providerId, modelIds] of Object.entries(recommendations)) {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) continue;

    for (const modelId of modelIds) {
      const model = provider.models[modelId];
      if (model && model.status !== 'deprecated') {
        recommended.push({ provider, model });
      }
    }
  }

  return recommended;
}

/**
 * Format cost for display
 */
export function formatCost(costPerMillion: number): string {
  return `$${costPerMillion.toFixed(2)}/M tokens`;
}

/**
 * Format token limit for display
 */
export function formatTokenLimit(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}K`;
  }
  return tokens.toString();
}

/**
 * Convert models.dev model to SpecForge internal format
 */
export function convertToSpecForgeModel(
  provider: ModelsDevProvider,
  model: ModelsDevModel,
  options: {
    enabled?: boolean;
    customDisplayName?: string;
  } = {}
) {
  return {
    id: model.id,
    provider: provider.id,
    displayName: options.customDisplayName || model.name,
    contextTokens: model.limit.context,
    maxOutputTokens: model.limit.output,
    defaultMax: Math.min(model.limit.output, 8000),
    enabled: options.enabled ?? true,
    // Additional metadata
    capabilities: {
      reasoning: model.reasoning,
      toolCall: model.tool_call,
      structuredOutput: model.structured_output ?? false,
      attachments: model.attachment,
    },
    pricing: {
      input: model.cost?.input ?? 0,
      output: model.cost?.output ?? 0,
    },
    npmPackage: provider.npm,
    apiEndpoint: provider.api,
    envVars: provider.env,
  };
}

/**
 * Check if a provider requires an API key
 */
export function providerRequiresApiKey(provider: ModelsDevProvider): boolean {
  return provider.env.length > 0;
}

/**
 * Get the primary environment variable key for a provider
 */
export function getProviderApiKeyEnvVar(
  provider: ModelsDevProvider
): string | null {
  return provider.env[0] || null;
}

/**
 * Check if a model is suitable for long-form content generation
 */
export function isModelSuitableForSpecs(model: ModelsDevModel): boolean {
  // Must support text input/output
  if (!model.modalities.input.includes('text')) return false;
  if (!model.modalities.output.includes('text')) return false;

  // Need reasonable context window
  if (model.limit.context < 32000) return false;

  // Need reasonable output capacity
  if (model.limit.output < 4096) return false;

  // Skip deprecated models
  if (model.status === 'deprecated') return false;

  return true;
}

/**
 * Validate that a model exists in the models.dev directory
 * Returns the provider and model info if found
 */
export async function validateModelInDirectory(
  modelId: string,
  providerId?: string
): Promise<{ provider: ModelsDevProvider; model: ModelsDevModel } | null> {
  return getModelById(modelId, providerId);
}

/**
 * Check if a provider is supported in models.dev
 */
export async function isProviderSupported(providerId: string): Promise<boolean> {
  const providers = await fetchModelDirectory();
  return providers.some((p) => p.id === providerId);
}

/**
 * Get provider environment variable requirements
 */
export async function getProviderEnvVars(providerId: string): Promise<string[]> {
  const providers = await fetchModelDirectory();
  const provider = providers.find((p) => p.id === providerId);
  return provider?.env || [];
}

/**
 * Validate provider credentials configuration
 * Returns validation result with helpful error messages
 */
export async function validateProviderConfig(
  providerId: string,
  options: {
    apiKey?: string;
    checkEnvVars?: boolean;
  } = {}
): Promise<{
  valid: boolean;
  error?: string;
  envVars?: string[];
  doc?: string;
}> {
  const providers = await fetchModelDirectory();
  const provider = providers.find((p) => p.id === providerId);

  if (!provider) {
    return {
      valid: false,
      error: `Provider "${providerId}" not found in model directory`,
    };
  }

  if (options.checkEnvVars && provider.env.length > 0) {
    if (!options.apiKey) {
      return {
        valid: false,
        error: `Provider "${provider.name}" requires API key`,
        envVars: provider.env,
        doc: provider.doc,
      };
    }
  }

  return {
    valid: true,
    envVars: provider.env,
    doc: provider.doc,
  };
}
