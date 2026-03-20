import { describe, it, expect } from 'vitest';
import { getModelById, getProviderDisplayName, resolveModelForCredentials, getFallbackModel } from '../registry';

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

describe('resolveModelForCredentials', () => {
  it('uses the model from credentials when it exists in registry', () => {
    const model = resolveModelForCredentials(
      { provider: 'deepseek', apiKey: 'key', modelId: 'deepseek-chat' },
      [],
      []
    );
    expect(model.id).toBe('deepseek-chat');
    expect(model.provider).toBe('deepseek');
  });

  it('trusts unknown model from credentials (not in registry)', () => {
    const model = resolveModelForCredentials(
      { provider: 'chutes', apiKey: 'key', modelId: 'deepseek-ai/DeepSeek-V3' },
      [],
      []
    );
    expect(model.id).toBe('deepseek-ai/DeepSeek-V3');
    expect(model.provider).toBe('chutes');
  });

  it('falls back to enabled model for provider when no modelId', () => {
    const model = resolveModelForCredentials(
      { provider: 'deepseek', apiKey: 'key', modelId: '' },
      [],
      [{ provider: 'deepseek', modelId: 'deepseek-chat', contextTokens: 128000, maxOutputTokens: 8000, defaultMax: 4000 }]
    );
    expect(model.id).toBe('deepseek-chat');
  });

  it('returns global fallback when no provider match exists', () => {
    const model = resolveModelForCredentials(
      { provider: 'unknown', apiKey: 'key', modelId: '' },
      [],
      []
    );
    const fallback = getFallbackModel();
    expect(model.id).toBe(fallback.id);
  });
});
