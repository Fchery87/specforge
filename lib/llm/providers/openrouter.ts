import { BaseProvider } from "../base-provider";
import type { LlmResponse } from "../types";

export class OpenRouterClient extends BaseProvider {
  supportsStreaming(): boolean {
    return true;
  }

  constructor(apiKey: string) {
    super(apiKey, "https://openrouter.ai/api/v1", "openrouter");
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
      max_tokens: options.maxTokens,
      temperature: options.temperature ?? 0.7,
    });
  }
}

export function createOpenRouterClient(apiKey: string): OpenRouterClient {
  return new OpenRouterClient(apiKey);
}
