import { describe, it, expect } from 'vitest';
import { getModelById, getProviderDisplayName } from '../registry';

describe('LLM Model Registry', () => {
  it('should find known models', () => {
    const gpt4 = getModelById('gpt-4o');
    expect(gpt4).toBeDefined();
    expect(gpt4?.provider).toBe('openai');
  });

  it('should return null for unknown models', () => {
    const unknown = getModelById('unknown-model-12345');
    expect(unknown).toBeNull();
  });

  it('should have correct model properties', () => {
    const model = getModelById('gpt-4o');
    if (model) {
      expect(model).toMatchObject({
        id: expect.any(String),
        provider: expect.any(String),
        contextTokens: expect.any(Number),
        maxOutputTokens: expect.any(Number),
      });
    }
  });

  it('returns display names for known providers', () => {
    expect(getProviderDisplayName('openrouter')).toBe('OpenRouter');
  });
});
