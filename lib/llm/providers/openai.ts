import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import { normalizeOpenAIResponse } from '../response-normalizer';

export interface OpenAIModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const OPENAI_MODELS: Record<string, OpenAIModelConfig> = {
  'gpt-4o': {
    modelId: 'gpt-4o',
    contextTokens: 128000,
    maxOutputTokens: 16384,
  },
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    contextTokens: 128000,
    maxOutputTokens: 16384,
  },
};

export class OpenAIClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1';

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
    const modelConfig = OPENAI_MODELS[options.model] || OPENAI_MODELS['gpt-4o'];

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens ?? modelConfig.maxOutputTokens,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
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

Generate the section now:`;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

export function createOpenAIClient(apiKey: string): OpenAIClient {
  return new OpenAIClient(apiKey);
}
