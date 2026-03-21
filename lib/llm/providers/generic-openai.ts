import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import { buildTransformedPrompts } from '../prompt-transformer';
import {
  normalizeOpenAIResponse,
  fetchWithTimeout,
} from '../response-normalizer';

/**
 * Generic OpenAI-compatible client
 * Works with any provider that implements the OpenAI API format
 * (NVIDIA, Groq, Fireworks, Together, etc.)
 */
export class GenericOpenAIClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string;
  private provider: string;

  constructor(apiKey: string, baseUrl: string, provider: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.provider = provider;
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
          model: options.model,
          messages,
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.7,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.provider} API error: ${error}`);
    }

    const data = await response.json();
    return normalizeOpenAIResponse(data);
  }

  async generateSection(
    request: LlmSectionRequest,
  ): Promise<{ content: string; tokens: number }> {
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      request,
      this.provider,
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

export function createGenericOpenAIClient(
  apiKey: string,
  baseUrl: string,
  provider: string,
): GenericOpenAIClient {
  return new GenericOpenAIClient(apiKey, baseUrl, provider);
}

// Provider-specific base URLs from models.dev
// These are OpenAI-compatible endpoints
export const PROVIDER_BASE_URLS: Record<string, string> = {
  nvidia: 'https://integrate.api.nvidia.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
  together: 'https://api.together.xyz/v1',
  replicate: 'https://api.replicate.com/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  ai21: 'https://api.ai21.com/studio/v1',
  cohere: 'https://api.cohere.com/v1',
  github: 'https://models.inference.ai.azure.com',
  vercel: 'https://ai-gateway.vercel.com/v1',
  azure: 'https://api.openai.com/v1', // Azure has custom endpoint handling
  google: 'https://generativelanguage.googleapis.com/v1', // Gemini
  chutes: 'https://llm.chutes.ai/v1', // CHUTES AI
  // Add more as needed from models.dev
};

export function getProviderBaseUrl(provider: string): string | null {
  return PROVIDER_BASE_URLS[provider] || null;
}
