import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import {
  normalizeAnthropicResponse,
  fetchWithTimeout,
} from '../response-normalizer';

export interface AnthropicModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const ANTHROPIC_MODELS: Record<string, AnthropicModelConfig> = {
  'claude-opus-4-5': {
    modelId: 'claude-opus-4-5',
    contextTokens: 200000,
    maxOutputTokens: 16384,
  },
  'claude-sonnet-4-5': {
    modelId: 'claude-sonnet-4-5',
    contextTokens: 200000,
    maxOutputTokens: 8192,
  },
  'claude-haiku-4-5': {
    modelId: 'claude-haiku-4-5',
    contextTokens: 200000,
    maxOutputTokens: 8192,
  },
};

export class AnthropicClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(
    prompt: string,
    options: {
      model: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<LlmResponse> {
    const modelConfig =
      ANTHROPIC_MODELS[options.model] || ANTHROPIC_MODELS['claude-sonnet-4-5'];

    const response = await fetchWithTimeout(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelConfig.modelId,
        max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
        temperature: options.temperature ?? 0.7,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return normalizeAnthropicResponse(data);
  }

  async generateSection(
    request: LlmSectionRequest
  ): Promise<{ content: string; tokens: number }> {
    const systemPrompt = this.buildSystemPrompt(request);
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.complete(`${systemPrompt}\n\n${userPrompt}`, {
      model: request.modelId,
      maxTokens: request.maxTokens,
      temperature: 0.7,
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

Generate the section now. Be comprehensive and detailed.`;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

export function createAnthropicClient(apiKey: string): AnthropicClient {
  return new AnthropicClient(apiKey);
}
