/**
 * React Hook for Models.dev Integration
 *
 * Provides easy access to the models.dev model directory
 * with caching and filtering capabilities.
 */

'use client';

import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useState, useEffect, useCallback } from 'react';

export interface ModelDirectoryEntry {
  id: string;
  provider: string;
  displayName: string;
  contextTokens: number;
  maxOutputTokens: number;
  defaultMax: number;
  enabled: boolean;
  capabilities: {
    reasoning: boolean;
    toolCall: boolean;
    structuredOutput: boolean;
    attachments: boolean;
  };
  pricing: {
    input: number;
    output: number;
  };
  npmPackage: string;
  apiEndpoint?: string;
  envVars: string[];
  formattedCost: {
    input: string;
    output: string;
  };
  formattedLimits: {
    context: string;
    output: string;
  };
}

export interface ProviderInfo {
  id: string;
  name: string;
  npm: string;
  env: string[];
  doc: string;
  api?: string;
  modelCount: number;
  requiresApiKey: boolean;
  primaryEnvVar: string | null;
}

interface UseModelDirectoryOptions {
  suitableForSpecs?: boolean;
  providerId?: string;
}

export function useModelDirectory(options: UseModelDirectoryOptions = {}) {
  const getModels = useAction(api.actions.modelDirectory.getModels);
  const getProviders = useAction(api.actions.modelDirectory.getProviders);
  const getRecommendedModels = useAction(api.actions.modelDirectory.getRecommendedModels);
  const searchModels = useAction(api.actions.modelDirectory.searchModels);
  const getModelsGroupedByProvider = useAction(api.actions.modelDirectory.getModelsGroupedByProvider);

  const [models, setModels] = useState<ModelDirectoryEntry[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [recommendedModels, setRecommendedModels] = useState<ModelDirectoryEntry[]>([]);
  const [groupedModels, setGroupedModels] = useState<
    Array<{
      provider: { id: string; name: string; npm: string; doc: string };
      models: ModelDirectoryEntry[];
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch providers on mount
  useEffect(() => {
    async function loadProviders() {
      try {
        const data = await getProviders({});
        setProviders(data);
      } catch (err) {
        console.error('Failed to load providers:', err);
        setError('Failed to load providers');
      }
    }
    loadProviders();
  }, [getProviders]);

  // Fetch models when options change
  useEffect(() => {
    async function loadModels() {
      setLoading(true);
      setError(null);
      try {
        const data = await getModels({
          providerId: options.providerId,
          suitableForSpecs: options.suitableForSpecs,
        });
        setModels(data as ModelDirectoryEntry[]);
      } catch (err) {
        console.error('Failed to load models:', err);
        setError('Failed to load models');
      } finally {
        setLoading(false);
      }
    }
    loadModels();
  }, [getModels, options.providerId, options.suitableForSpecs]);

  // Fetch recommended models on mount
  useEffect(() => {
    async function loadRecommended() {
      try {
        const data = await getRecommendedModels({});
        setRecommendedModels(data as ModelDirectoryEntry[]);
      } catch (err) {
        console.error('Failed to load recommended models:', err);
      }
    }
    loadRecommended();
  }, [getRecommendedModels]);

  // Fetch grouped models on mount
  useEffect(() => {
    async function loadGrouped() {
      try {
        const data = await getModelsGroupedByProvider({
          suitableForSpecs: options.suitableForSpecs,
        });
        setGroupedModels(data as typeof groupedModels);
      } catch (err) {
        console.error('Failed to load grouped models:', err);
      }
    }
    loadGrouped();
  }, [getModelsGroupedByProvider, options.suitableForSpecs]);

  const search = useCallback(
    async (query: string, limit?: number) => {
      if (!query.trim()) return models;
      try {
        const results = await searchModels({ query, limit });
        return results as ModelDirectoryEntry[];
      } catch (err) {
        console.error('Search failed:', err);
        return [];
      }
    },
    [searchModels, models]
  );

  const getProviderModels = useCallback(
    (providerId: string) => {
      return models.filter((m) => m.provider === providerId);
    },
    [models]
  );

  const getModelById = useCallback(
    (modelId: string) => {
      return models.find((m) => m.id === modelId) || null;
    },
    [models]
  );

  const getProviderInfo = useCallback(
    (providerId: string) => {
      return providers.find((p) => p.id === providerId) || null;
    },
    [providers]
  );

  return {
    models,
    providers,
    recommendedModels,
    groupedModels,
    loading,
    error,
    search,
    getProviderModels,
    getModelById,
    getProviderInfo,
  };
}

export function useRecommendedModels() {
  const getRecommendedModels = useAction(api.actions.modelDirectory.getRecommendedModels);
  const [models, setModels] = useState<ModelDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getRecommendedModels({});
        setModels(data as ModelDirectoryEntry[]);
      } catch (err) {
        console.error('Failed to load recommended models:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getRecommendedModels]);

  return { models, loading };
}

export function useModelSearch() {
  const searchModels = useAction(api.actions.modelDirectory.searchModels);
  const [results, setResults] = useState<ModelDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (query: string, limit?: number) => {
      if (!query.trim()) {
        setResults([]);
        return [];
      }
      setLoading(true);
      try {
        const data = await searchModels({ query, limit });
        const typed = data as ModelDirectoryEntry[];
        setResults(typed);
        return typed;
      } catch (err) {
        console.error('Search failed:', err);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [searchModels]
  );

  return { results, loading, search };
}
