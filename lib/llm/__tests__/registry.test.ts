import { describe, it, expect } from 'vitest';
import {
  getModelById,
  getProviderDisplayName,
  resolveModelForCredentials,
  getFallbackModel,
  validateProviderModelMatch,
} from '../registry';
import type { LlmModel } from '../types';

describe('LLM Model Registry', () => {
  it('should find known models', () => {
    const flagship = getModelById('gpt-5.4');
    expect(flagship).toBeDefined();
    expect(flagship?.provider).toBe('openai');
    expect(flagship?.contextTokens).toBeGreaterThan(0);
    expect(getModelById('gpt-5.4-mini')?.provider).toBe('openai');
    expect(getModelById('gpt-4o')).toBeNull();
  });

  it('should return null for unknown models', () => {
    const unknown = getModelById('unknown-model-12345');
    expect(unknown).toBeNull();
  });

  it('should have correct model properties', () => {
    const model = getModelById('gpt-5.4');
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

describe('validateProviderModelMatch', () => {
  it('validates known deepseek models for deepseek provider', () => {
    expect(validateProviderModelMatch('deepseek', 'deepseek-flash').valid).toBe(true);
    expect(validateProviderModelMatch('deepseek', 'deepseek-v4-flash').valid).toBe(true);
    expect(validateProviderModelMatch('deepseek', 'deepseek-chat').valid).toBe(true);
    expect(validateProviderModelMatch('deepseek', 'deepseek-reasoner').valid).toBe(true);
  });

  it('allows dynamic unlisted models matching provider prefix', () => {
    expect(validateProviderModelMatch('deepseek', 'deepseek-coder-v3').valid).toBe(true);
  });

  it('rejects cross-provider mismatch for known models', () => {
    const result = validateProviderModelMatch('openai', 'deepseek-flash');
    expect(result.valid).toBe(false);
    expect(result.error).toContain("doesn't match provider openai");
  });

  it('rejects cross-provider mismatch for prefixed dynamic models', () => {
    const result = validateProviderModelMatch('anthropic', 'deepseek-custom-70b');
    expect(result.valid).toBe(false);
    expect(result.error).toContain("doesn't match provider anthropic");
  });

  it('allows openai models on azure', () => {
    expect(validateProviderModelMatch('azure', 'gpt-5.4').valid).toBe(true);
  });

  it('allows any model on multi-model aggregators like openrouter and chutes', () => {
    expect(validateProviderModelMatch('openrouter', 'anthropic/claude-sonnet-4').valid).toBe(true);
    expect(validateProviderModelMatch('chutes', 'deepseek-ai/DeepSeek-V3').valid).toBe(true);
  });

  it('requires a modelId', () => {
    expect(validateProviderModelMatch('deepseek', '').valid).toBe(false);
  });
});
