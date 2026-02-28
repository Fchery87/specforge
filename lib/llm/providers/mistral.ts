import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import { buildTransformedPrompts } from '../prompt-transformer';
import {
  normalizeOpenAIResponse,
  fetchWithTimeout,
} from '../response-normalizer';

export interface MistralModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const MISTRAL_MODELS: Record<string, MistralModelConfig> = {
  'mistral-large-3': {
    modelId: 'mistral-large-3',
    contextTokens: 256000,
    maxOutputTokens: 8192,
  },
  'mistral-medium-3-1': {
    modelId: 'mistral-medium-3-1',
    contextTokens: 128000,
    maxOutputTokens: 8192,
  },
  'mistral-small-3-2': {
    modelId: 'mistral-small-3-2',
    contextTokens: 128000,
    maxOutputTokens: 8192,
  },
};

export class MistralClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.mistral.ai/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(
    prompt: string,
    options: {
      model: string;
      maxTokens?: number;
      temperature?: number;
    },
  ): Promise<LlmResponse> {
    const modelConfig =
      MISTRAL_MODELS[options.model] || MISTRAL_MODELS['mistral-large-3'];

    const response = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: modelConfig.modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
          temperature: options.temperature ?? 0.7,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${error}`);
    }

    const data = await response.json();
    return normalizeOpenAIResponse(data);
  }

  async generateSection(
    request: LlmSectionRequest,
  ): Promise<{ content: string; tokens: number }> {
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      request,
      'mistral',
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

export function createMistralClient(apiKey: string): MistralClient {
  return new MistralClient(apiKey);
}
