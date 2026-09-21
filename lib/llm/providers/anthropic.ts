import { BaseProvider } from "../base-provider";
import { fetchWithTimeout, normalizeAnthropicResponse } from "../response-normalizer";
import type { LlmResponse } from "../types";

export interface AnthropicModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const ANTHROPIC_MODELS: Record<string, AnthropicModelConfig> = {
  "claude-opus-4-5": {
    modelId: "claude-opus-4-5",
    contextTokens: 200000,
    maxOutputTokens: 16384,
  },
  "claude-sonnet-4-5": {
    modelId: "claude-sonnet-4-5",
    contextTokens: 200000,
    maxOutputTokens: 8192,
  },
  "claude-haiku-4-5": {
    modelId: "claude-haiku-4-5",
    contextTokens: 200000,
    maxOutputTokens: 8192,
  },
};

export class AnthropicClient extends BaseProvider {
  constructor(apiKey: string) {
    super(apiKey, "https://api.anthropic.com/v1", "anthropic");
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
      ANTHROPIC_MODELS[options.model] || ANTHROPIC_MODELS["claude-sonnet-4-5"];

    const body: Record<string, unknown> = {
      model: modelConfig.modelId,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
      temperature: options.temperature ?? 0.7,
      messages: [{ role: "user", content: prompt }],
    };
    if (options.systemPrompt) {
      body.system = options.systemPrompt;
    }

    const response = await fetchWithTimeout(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[Anthropic] API error (${response.status}):`,
        errorText,
      );
      throw new Error(`Anthropic API error: HTTP ${response.status}`);
    }

    const data = await response.json();
    return normalizeAnthropicResponse(data);
  }
}

export function createAnthropicClient(apiKey: string): AnthropicClient {
  return new AnthropicClient(apiKey);
}
