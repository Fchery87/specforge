import { BaseProvider } from "../base-provider";
import type { LlmResponse } from "../types";

export interface MistralModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const MISTRAL_MODELS: Record<string, MistralModelConfig> = {
  "mistral-large-3": {
    modelId: "mistral-large-3",
    contextTokens: 256000,
    maxOutputTokens: 8192,
  },
  "mistral-medium-3-1": {
    modelId: "mistral-medium-3-1",
    contextTokens: 128000,
    maxOutputTokens: 8192,
  },
  "mistral-small-3-2": {
    modelId: "mistral-small-3-2",
    contextTokens: 128000,
    maxOutputTokens: 8192,
  },
};

export class MistralClient extends BaseProvider {
  supportsStreaming(): boolean {
    return true;
  }

  constructor(apiKey: string) {
    super(apiKey, "https://api.mistral.ai/v1", "mistral");
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
      MISTRAL_MODELS[options.model] || MISTRAL_MODELS["mistral-large-3"];
    const messages = this.buildMessages(prompt, options.systemPrompt);

    return this.openAIChatComplete({
      model: modelConfig.modelId,
      messages,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
      temperature: options.temperature ?? 0.7,
    });
  }
}

export function createMistralClient(apiKey: string): MistralClient {
  return new MistralClient(apiKey);
}
