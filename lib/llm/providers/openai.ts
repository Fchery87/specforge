import { BaseProvider } from "../base-provider";
import type { LlmResponse } from "../types";

export interface OpenAIModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const OPENAI_MODELS: Record<string, OpenAIModelConfig> = {
  "gpt-5.4": {
    modelId: "gpt-5.4",
    contextTokens: 1050000,
    maxOutputTokens: 128000,
  },
  "gpt-5.4-mini": {
    modelId: "gpt-5.4-mini",
    contextTokens: 400000,
    maxOutputTokens: 128000,
  },
};

export class OpenAIClient extends BaseProvider {
  supportsStreaming(): boolean {
    return true;
  }

  constructor(apiKey: string) {
    super(apiKey, "https://api.openai.com/v1", "openai");
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
      OPENAI_MODELS[options.model] || OPENAI_MODELS["gpt-5.4"];
    const messages = this.buildMessages(prompt, options.systemPrompt);

    return this.openAIChatComplete({
      model: modelConfig.modelId,
      messages,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
      temperature: options.temperature ?? 0.7,
    });
  }
}

export function createOpenAIClient(apiKey: string): OpenAIClient {
  return new OpenAIClient(apiKey);
}
