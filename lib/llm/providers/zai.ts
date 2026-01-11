import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import {
  normalizeOpenAIResponse,
  fetchWithTimeout,
} from '../response-normalizer';

export interface ZAIModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const ZAI_MODELS: Record<string, ZAIModelConfig> = {
  'glm-4.7': {
    modelId: 'glm-4.7',
    contextTokens: 204800,
    maxOutputTokens: 131100,
  },
  'glm-4.6': {
    modelId: 'glm-4.6',
    contextTokens: 128000,
    maxOutputTokens: 96000,
  },
  'glm-4.5': {
    modelId: 'glm-4.5',
    contextTokens: 128000,
    maxOutputTokens: 96000,
  },
  'glm-4.5-air': {
    modelId: 'glm-4.5-air',
    contextTokens: 128000,
    maxOutputTokens: 96000,
  },
  'glm-4.5-flash': {
    modelId: 'glm-4.5-flash',
    contextTokens: 128000,
    maxOutputTokens: 96000,
  },
};

// Z.AI Endpoint types
export type ZAIEndpointType = 'paid' | 'coding';

export const ZAI_ENDPOINTS: Record<
  ZAIEndpointType,
  { label: string; url: string; description: string }
> = {
  paid: {
    label: 'Paid API',
    url: 'https://api.z.ai/api/paas/v4',
    description: 'Pay-as-you-go API billing',
  },
  coding: {
    label: 'Coding Plan',
    url: 'https://api.z.ai/api/coding/paas/v4',
    description: 'Subscription-based coding plan (GLM Coding Plan)',
  },
};

// China endpoints
export const ZAI_ENDPOINTS_CN: Record<
  ZAIEndpointType,
  { label: string; url: string; description: string }
> = {
  paid: {
    label: 'Paid API (China)',
    url: 'https://open.bigmodel.cn/api/paas/v4',
    description: 'Pay-as-you-go API billing (China region)',
  },
  coding: {
    label: 'Coding Plan (China)',
    url: 'https://open.bigmodel.cn/api/coding/paas/v4',
    description: 'Subscription-based coding plan (China region)',
  },
};

export class ZAIClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(
    apiKey: string,
    endpointType: ZAIEndpointType = 'paid',
    isChina: boolean = false
  ) {
    this.apiKey = apiKey;
    const endpoints = isChina ? ZAI_ENDPOINTS_CN : ZAI_ENDPOINTS;
    this.baseUrl = endpoints[endpointType].url;
  }

  async complete(
    prompt: string,
    options: {
      model: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<LlmResponse> {
    const modelConfig = ZAI_MODELS[options.model] || ZAI_MODELS['glm-4.5'];

    const response = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: modelConfig.modelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
          temperature: options.temperature ?? 0.6,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Z.AI API error: ${error}`);
    }

    const data = await response.json();

    // Use centralized normalizer which handles reasoning models like GLM-4.7
    return normalizeOpenAIResponse(data);
  }

  async generateSection(
    request: LlmSectionRequest
  ): Promise<{ content: string; tokens: number }> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.complete(`${systemPrompt}\n\n${userPrompt}`, {
      model: request.modelId,
      maxTokens: request.maxTokens,
      temperature: 0.6,
    });

    return {
      content: response.content,
      tokens: response.usage.completionTokens,
    };
  }

  private buildSystemPrompt(request: LlmSectionRequest): string {
    return `You are an expert technical writer creating a ${request.artifactType} document.
Your task is to generate the "${request.sectionName}" section.

Context from previous sections:
${request.previousSections.map((s) => `## ${s.name}\n${s.content}`).join('\n\n') || 'No previous sections.'}

Current section requirements:
${request.sectionInstructions || 'Generate comprehensive, detailed content for this section.'}

Guidelines:
- Use markdown formatting
- Be thorough and detailed
- Include code examples where appropriate
- Maintain consistent style throughout
- Focus on actionable, technical content`;
  }

  private buildUserPrompt(request: LlmSectionRequest): string {
    return `Please generate the "${request.sectionName}" section for this ${request.artifactType}.

Project: ${request.projectContext.title}
Description: ${request.projectContext.description}

${
  request.sectionQuestions.length > 0
    ? `Answer these questions based on the project context:\n${request.sectionQuestions.map((q) => `- ${q}`).join('\n')}`
    : ''
}

Generate the section now:`;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

export function createZAIClient(
  apiKey: string,
  endpointType: ZAIEndpointType = 'paid',
  isChina: boolean = false
): ZAIClient {
  return new ZAIClient(apiKey, endpointType, isChina);
}
