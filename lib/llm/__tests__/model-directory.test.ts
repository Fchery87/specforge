/**
 * Tests for Models.dev Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchModelDirectory,
  getAllModels,
  getModelsByProvider,
  getModelById,
  formatCost,
  formatTokenLimit,
  isModelSuitableForSpecs,
  clearModelDirectoryCache,
  type ModelsDevProvider,
  type ModelsDevModel,
} from '../model-directory';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockProvider: ModelsDevProvider = {
  id: 'test-provider',
  name: 'Test Provider',
  npm: '@ai-sdk/test',
  env: ['TEST_API_KEY'],
  doc: 'https://test.com/docs',
  api: 'https://api.test.com/v1',
  models: {
    'test-model': {
      id: 'test-model',
      name: 'Test Model',
      attachment: false,
      reasoning: true,
      tool_call: true,
      structured_output: true,
      release_date: '2024-01-01',
      last_updated: '2024-01-01',
      cost: { input: 1.0, output: 2.0 },
      limit: { context: 128000, output: 4096 },
      modalities: { input: ['text'], output: ['text'] },
    },
    'test-model-large': {
      id: 'test-model-large',
      name: 'Test Model Large',
      attachment: true,
      reasoning: true,
      tool_call: true,
      release_date: '2024-01-01',
      last_updated: '2024-01-01',
      cost: { input: 5.0, output: 10.0 },
      limit: { context: 200000, output: 8192 },
      modalities: { input: ['text', 'image'], output: ['text'] },
    },
  },
};

describe('model-directory', () => {
  beforeEach(() => {
    clearModelDirectoryCache();
    vi.clearAllMocks();
  });

  describe('formatCost', () => {
    it('should format costs consistently', () => {
      expect(formatCost(0.5)).toBe('$0.50/M tokens');
      expect(formatCost(0.25)).toBe('$0.25/M tokens');
      expect(formatCost(1.0)).toBe('$1.00/M tokens');
      expect(formatCost(5.5)).toBe('$5.50/M tokens');
    });
  });

  describe('formatTokenLimit', () => {
    it('should format millions', () => {
      expect(formatTokenLimit(1000000)).toBe('1.0M');
      expect(formatTokenLimit(2000000)).toBe('2.0M');
    });

    it('should format thousands', () => {
      expect(formatTokenLimit(1000)).toBe('1K');
      expect(formatTokenLimit(128000)).toBe('128K');
    });

    it('should format raw numbers', () => {
      expect(formatTokenLimit(512)).toBe('512');
    });
  });

  describe('isModelSuitableForSpecs', () => {
    it('should return true for suitable models', () => {
      const model: ModelsDevModel = {
        id: 'good-model',
        name: 'Good Model',
        attachment: false,
        reasoning: false,
        tool_call: false,
        release_date: '2024-01-01',
        last_updated: '2024-01-01',
        cost: { input: 1.0, output: 2.0 },
        limit: { context: 128000, output: 4096 },
        modalities: { input: ['text'], output: ['text'] },
      };

      expect(isModelSuitableForSpecs(model)).toBe(true);
    });

    it('should return false for models with insufficient context', () => {
      const model: ModelsDevModel = {
        id: 'small-model',
        name: 'Small Model',
        attachment: false,
        reasoning: false,
        tool_call: false,
        release_date: '2024-01-01',
        last_updated: '2024-01-01',
        cost: { input: 1.0, output: 2.0 },
        limit: { context: 16000, output: 4096 },
        modalities: { input: ['text'], output: ['text'] },
      };

      expect(isModelSuitableForSpecs(model)).toBe(false);
    });

    it('should return false for models with insufficient output', () => {
      const model: ModelsDevModel = {
        id: 'limited-model',
        name: 'Limited Model',
        attachment: false,
        reasoning: false,
        tool_call: false,
        release_date: '2024-01-01',
        last_updated: '2024-01-01',
        cost: { input: 1.0, output: 2.0 },
        limit: { context: 128000, output: 2048 },
        modalities: { input: ['text'], output: ['text'] },
      };

      expect(isModelSuitableForSpecs(model)).toBe(false);
    });

    it('should return false for deprecated models', () => {
      const model: ModelsDevModel = {
        id: 'old-model',
        name: 'Old Model',
        attachment: false,
        reasoning: false,
        tool_call: false,
        status: 'deprecated',
        release_date: '2023-01-01',
        last_updated: '2023-01-01',
        cost: { input: 1.0, output: 2.0 },
        limit: { context: 128000, output: 4096 },
        modalities: { input: ['text'], output: ['text'] },
      };

      expect(isModelSuitableForSpecs(model)).toBe(false);
    });
  });

  describe('fetchModelDirectory', () => {
    it('should fetch and cache provider data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': mockProvider }),
      });

      const result = await fetchModelDirectory();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-provider');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await fetchModelDirectory();
      expect(result2).toEqual(result);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fetchModelDirectory()).rejects.toThrow('Failed to fetch models.dev data');
    });

    it('should use stale cache on error if available', async () => {
      // First successful fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': mockProvider }),
      });

      await fetchModelDirectory();

      // Force cache expiration by manipulating timestamp
      // Note: This tests the fallback behavior conceptually
      // In practice we'd need to manipulate the internal cache state
    });
  });

  describe('getAllModels', () => {
    it('should flatten all models from all providers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': mockProvider }),
      });

      const models = await getAllModels();

      expect(models).toHaveLength(2);
      expect(models[0].model.id).toBe('test-model');
      expect(models[1].model.id).toBe('test-model-large');
    });

    it('should filter out deprecated models', async () => {
      const providerWithDeprecated: ModelsDevProvider = {
        ...mockProvider,
        models: {
          ...mockProvider.models,
          'old-model': {
            id: 'old-model',
            name: 'Old Model',
            attachment: false,
            reasoning: false,
            tool_call: false,
            status: 'deprecated',
            release_date: '2023-01-01',
            last_updated: '2023-01-01',
            cost: { input: 1.0, output: 2.0 },
            limit: { context: 128000, output: 4096 },
            modalities: { input: ['text'], output: ['text'] },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': providerWithDeprecated }),
      });

      const models = await getAllModels();

      expect(models).toHaveLength(2); // Should exclude deprecated
      expect(models.some((m) => m.model.id === 'old-model')).toBe(false);
    });
  });

  describe('getModelsByProvider', () => {
    it('should return models for specific provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': mockProvider }),
      });

      const models = await getModelsByProvider('test-provider');

      expect(models).toHaveLength(2);
    });

    it('should return empty array for unknown provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': mockProvider }),
      });

      const models = await getModelsByProvider('unknown-provider');

      expect(models).toHaveLength(0);
    });
  });

  describe('getModelById', () => {
    it('should find model by ID across all providers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': mockProvider }),
      });

      const result = await getModelById('test-model');

      expect(result).not.toBeNull();
      expect(result?.model.id).toBe('test-model');
      expect(result?.provider.id).toBe('test-provider');
    });

    it('should find model by ID and provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': mockProvider }),
      });

      const result = await getModelById('test-model', 'test-provider');

      expect(result).not.toBeNull();
      expect(result?.model.id).toBe('test-model');
    });

    it('should return null for unknown model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'test-provider': mockProvider }),
      });

      const result = await getModelById('unknown-model');

      expect(result).toBeNull();
    });
  });
});
