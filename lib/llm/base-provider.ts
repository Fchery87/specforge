import type { LlmProvider, LlmResponse, LlmSectionRequest } from "./types";
import { buildTransformedPrompts } from "./prompt-transformer";
import {
  normalizeOpenAIResponse,
  fetchWithTimeout,
} from "./response-normalizer";
import { parseSseStream } from "./sse-parser";

export abstract class BaseProvider implements LlmProvider {
  protected apiKey: string;
  protected baseUrl: string;
  protected providerName: string;
  protected defaultTemperature = 0.7;

  constructor(apiKey: string, baseUrl: string, providerName: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.providerName = providerName;
  }

  abstract complete(
    prompt: string,
    options: {
      model: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    },
  ): Promise<LlmResponse>;

  async generateSection(
    request: LlmSectionRequest,
  ): Promise<{ content: string; tokens: number }> {
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      request,
      this.providerName,
    );

    const response = await this.complete(userPrompt, {
      model: request.modelId,
      maxTokens: request.maxTokens,
      temperature: this.defaultTemperature,
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

  supportsStreaming(): boolean {
    return false;
  }

  async *streamComplete(
    prompt: string,
    options: {
      model: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      signal?: AbortSignal;
    },
  ): AsyncGenerator<string, void, undefined> {
    const response = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: options.model,
        messages: this.buildMessages(prompt, options.systemPrompt),
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? this.defaultTemperature,
        stream: true,
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${this.providerName}] streaming API error (${response.status}):`,
        errorText,
      );
      throw new Error(
        `${this.providerName} streaming API error: HTTP ${response.status}`,
      );
    }

    if (!response.body) {
      throw new Error(`${this.providerName} streaming returned no body`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { deltas, rest, done: streamDone } = parseSseStream(buffer);
      buffer = rest;

      for (const delta of deltas) {
        yield delta;
      }
      if (streamDone) break;
    }
  }

  protected async openAIChatComplete(
    body: Record<string, unknown>,
  ): Promise<LlmResponse> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[${this.providerName}] API error (${response.status}):`,
        errorText,
      );
      throw new Error(`${this.providerName} API error: HTTP ${response.status}`);
    }

    const data = await response.json();
    return normalizeOpenAIResponse(data);
  }

  protected buildMessages(
    prompt: string,
    systemPrompt?: string,
  ): Array<{ role: "system" | "user"; content: string }> {
    if (!systemPrompt) return [{ role: "user", content: prompt }];
    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ];
  }
}
