import { BaseProvider } from "../base-provider";
import type { LlmResponse } from "../types";

export class GenericOpenAIClient extends BaseProvider {
  supportsStreaming(): boolean {
    return true;
  }

  constructor(apiKey: string, baseUrl: string, provider: string) {
    const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    super(apiKey, normalized, provider);
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
    const messages = this.buildMessages(prompt, options.systemPrompt);

    return this.openAIChatComplete({
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
    });
  }
}

export function createGenericOpenAIClient(
  apiKey: string,
  baseUrl: string,
  provider: string,
): GenericOpenAIClient {
  return new GenericOpenAIClient(apiKey, baseUrl, provider);
}

export const PROVIDER_BASE_URLS: Record<string, string> = {
  nvidia: "https://integrate.api.nvidia.com/v1",
  groq: "https://api.groq.com/openai/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  together: "https://api.together.xyz/v1",
  replicate: "https://api.replicate.com/v1",
  cerebras: "https://api.cerebras.ai/v1",
  ai21: "https://api.ai21.com/studio/v1",
  cohere: "https://api.cohere.com/v1",
  github: "https://models.inference.ai.azure.com",
  vercel: "https://ai-gateway.vercel.com/v1",
  azure: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1",
  chutes: "https://llm.chutes.ai/v1",
};

export function getProviderBaseUrl(provider: string): string | null {
  return PROVIDER_BASE_URLS[provider] || null;
}
