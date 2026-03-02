import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import { buildTransformedPrompts } from '../prompt-transformer';
import {
  normalizeAnthropicResponse,
  fetchWithTimeout,
} from '../response-normalizer';

export interface AnthropicModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const ANTHROPIC_MODELS: Record<string, AnthropicModelConfig> = {
  'claude-opus-4-5': {
    modelId: 'claude-opus-4-5',
    contextTokens: 200000,
    maxOutputTokens: 16384,
  },
  'claude-sonnet-4-5': {
    modelId: 'claude-sonnet-4-5',
    contextTokens: 200000,
    maxOutputTokens: 8192,
  },
  'claude-haiku-4-5': {
    modelId: 'claude-haiku-4-5',
    contextTokens: 200000,
    maxOutputTokens: 8192,
  },
};

export class AnthropicClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(
    prompt: string,
    options: {
      model: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    },
  ): Promise<LlmResponse> {
    const modelConfig =
      ANTHROPIC_MODELS[options.model] || ANTHROPIC_MODELS['claude-sonnet-4-5'];

    // Anthropic uses a top-level 'system' field, not a system message in the array
    const body: Record<string, unknown> = {
      model: modelConfig.modelId,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
      temperature: options.temperature ?? 0.7,
      messages: [{ role: 'user', content: prompt }],
    };
    if (options.systemPrompt) {
      body.system = options.systemPrompt;
    }

    const response = await fetchWithTimeout(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return normalizeAnthropicResponse(data);
  }

  async generateSection(
    request: LlmSectionRequest,
  ): Promise<{ content: string; tokens: number }> {
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      request,
      'anthropic',
    );

    const response = await this.complete(`${systemPrompt}\n\n${userPrompt}`, {
      model: request.modelId,
      maxTokens: request.maxTokens,
      temperature: 0.7,
    });

    return {
      content: response.content,
      tokens: response.usage.completionTokens,
    };
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

export function createAnthropicClient(apiKey: string): AnthropicClient {
  return new AnthropicClient(apiKey);
}
