import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import { buildTransformedPrompts } from '../prompt-transformer';
import {
  normalizeOpenAIResponse,
  fetchWithTimeout,
} from '../response-normalizer';

export interface OpenAIModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const OPENAI_MODELS: Record<string, OpenAIModelConfig> = {
  'gpt-4o': {
    modelId: 'gpt-4o',
    contextTokens: 128000,
    maxOutputTokens: 16384,
  },
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    contextTokens: 128000,
    maxOutputTokens: 16384,
  },
};

export class OpenAIClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

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
    const modelConfig = OPENAI_MODELS[options.model] || OPENAI_MODELS['gpt-4o'];

    const messages = options.systemPrompt
      ? [
          { role: 'system' as const, content: options.systemPrompt },
          { role: 'user' as const, content: prompt },
        ]
      : [{ role: 'user' as const, content: prompt }];

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
          messages,
          max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
          temperature: options.temperature ?? 0.7,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      // Log raw error server-side for debugging, but don't expose to callers
      console.error(`[OpenAI] API error (${response.status}):`, errorText);
      throw new Error(`OpenAI API error: HTTP ${response.status}`);
    }

    const data = await response.json();
    return normalizeOpenAIResponse(data);
  }

  async generateSection(
    request: LlmSectionRequest,
  ): Promise<{ content: string; tokens: number }> {
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      request,
      'openai',
    );

    const response = await this.complete(userPrompt, {
      model: request.modelId,
      maxTokens: request.maxTokens,
      temperature: 0.7,
      systemPrompt,
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

export function createOpenAIClient(apiKey: string): OpenAIClient {
  return new OpenAIClient(apiKey);
}
