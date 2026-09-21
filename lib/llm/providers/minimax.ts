import { BaseProvider } from "../base-provider";
import type { LlmResponse } from "../types";

export interface MinimaxModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const MINIMAX_MODELS: Record<string, MinimaxModelConfig> = {
  "minimax-m2.1": {
    modelId: "MiniMax-M2.1",
    contextTokens: 1000000,
    maxOutputTokens: 1000000,
  },
  "minimax-m2.1-lightning": {
    modelId: "MiniMax-M2.1-lightning",
    contextTokens: 1000000,
    maxOutputTokens: 1000000,
  },
  "minimax-m2": {
    modelId: "MiniMax-M2",
    contextTokens: 1000000,
    maxOutputTokens: 1000000,
  },
  "minimax-01": {
    modelId: "MiniMax-Text-01",
    contextTokens: 4000000,
    maxOutputTokens: 4000000,
  },
};

export class MinimaxClient extends BaseProvider {
  supportsStreaming(): boolean {
    return true;
  }

  constructor(apiKey: string) {
    super(apiKey, "https://api.minimax.io/v1", "minimax");
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
      MINIMAX_MODELS[options.model] || MINIMAX_MODELS["minimax-m2"];
    const messages = this.buildMessages(prompt, options.systemPrompt);

    return this.openAIChatComplete({
      model: modelConfig.modelId,
      messages,
      max_tokens:
        options.maxTokens ?? Math.min(modelConfig.maxOutputTokens, 4096),
      temperature: options.temperature ?? 0.7,
    });
  }
}

export function createMinimaxClient(apiKey: string): MinimaxClient {
  return new MinimaxClient(apiKey);
}
