import { describe, it, expect } from 'vitest';
import { createLlmClient } from '../../lib/llm/client-factory';
import { GenericOpenAIClient } from '../../lib/llm/providers/generic-openai';
import { AnthropicClient } from '../../lib/llm/providers/anthropic';
import { DeepSeekClient } from '../../lib/llm/providers/deepseek';

describe('client-factory', () => {
  it('instantiates Anthropic when provider is anthropic', () => {
    const client = createLlmClient({
      apiKey: 'test',
      provider: 'anthropic',
      modelId: 'test',
    });
    expect(client).toBeInstanceOf(AnthropicClient);
  });

  it('instantiates DeepSeek when provider is deepseek', () => {
    const client = createLlmClient({
      apiKey: 'test',
      provider: 'deepseek',
      modelId: 'test',
    });
    expect(client).toBeInstanceOf(DeepSeekClient);
  });

  it('instantiates GenericOpenAIClient for unknown providers with a baseUrl', () => {
    const client = createLlmClient(
      { apiKey: 'test', provider: 'nvidia', modelId: 'test' },
      'https://integrate.api.nvidia.com/v1',
    );
    expect(client).toBeInstanceOf(GenericOpenAIClient);
  });

  it('returns null if provider is unknown and no endpoint is given', () => {
    const client = createLlmClient({
      apiKey: 'test',
      provider: 'unknown_provider',
      modelId: 'test',
    });
    expect(client).toBeNull();
  });
});
