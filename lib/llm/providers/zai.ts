import { BaseProvider } from "../base-provider";
import type { LlmResponse } from "../types";

export interface ZAIModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const ZAI_MODELS: Record<string, ZAIModelConfig> = {
  "glm-4.7": {
    modelId: "glm-4.7",
    contextTokens: 204800,
    maxOutputTokens: 131100,
  },
  "glm-4.6": {
    modelId: "glm-4.6",
    contextTokens: 128000,
    maxOutputTokens: 96000,
  },
  "glm-4.5": {
    modelId: "glm-4.5",
    contextTokens: 128000,
    maxOutputTokens: 96000,
  },
  "glm-4.5-air": {
    modelId: "glm-4.5-air",
    contextTokens: 128000,
    maxOutputTokens: 96000,
  },
  "glm-4.5-flash": {
    modelId: "glm-4.5-flash",
    contextTokens: 128000,
    maxOutputTokens: 96000,
  },
};

export type ZAIEndpointType = "paid" | "coding";

export const ZAI_ENDPOINTS: Record<
  ZAIEndpointType,
  { label: string; url: string; description: string }
> = {
  paid: {
    label: "Paid API",
    url: "https://api.z.ai/api/paas/v4",
    description: "Pay-as-you-go API billing",
  },
  coding: {
    label: "Coding Plan",
    url: "https://api.z.ai/api/coding/paas/v4",
    description: "Subscription-based coding plan (GLM Coding Plan)",
  },
};

export const ZAI_ENDPOINTS_CN: Record<
  ZAIEndpointType,
  { label: string; url: string; description: string }
> = {
  paid: {
    label: "Paid API (China)",
    url: "https://open.bigmodel.cn/api/paas/v4",
    description: "Pay-as-you-go API billing (China region)",
  },
  coding: {
    label: "Coding Plan (China)",
    url: "https://open.bigmodel.cn/api/coding/paas/v4",
    description: "Subscription-based coding plan (China region)",
  },
};

export class ZAIClient extends BaseProvider {
  supportsStreaming(): boolean {
    return true;
  }

  constructor(
    apiKey: string,
    endpointType: ZAIEndpointType = "paid",
    isChina: boolean = false,
  ) {
    const endpoints = isChina ? ZAI_ENDPOINTS_CN : ZAI_ENDPOINTS;
    super(apiKey, endpoints[endpointType].url, "zai");
    this.defaultTemperature = 0.6;
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
    const modelConfig = ZAI_MODELS[options.model] || ZAI_MODELS["glm-4.5"];
    const messages = this.buildMessages(prompt, options.systemPrompt);

    return this.openAIChatComplete({
      model: modelConfig.modelId,
      messages,
      max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
      temperature: options.temperature ?? 0.6,
    });
  }
}

export function createZAIClient(
  apiKey: string,
  endpointType: ZAIEndpointType = "paid",
  isChina: boolean = false,
): ZAIClient {
  return new ZAIClient(apiKey, endpointType, isChina);
}
