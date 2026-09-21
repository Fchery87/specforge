import { BaseProvider } from "../base-provider";
import type { LlmResponse } from "../types";

export class DeepSeekClient extends BaseProvider {
  supportsStreaming(): boolean {
    return true;
  }

  constructor(apiKey: string) {
    super(apiKey, "https://api.deepseek.com", "deepseek");
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

export function createDeepSeekClient(apiKey: string): DeepSeekClient {
  return new DeepSeekClient(apiKey);
}
