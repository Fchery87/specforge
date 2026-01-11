import type { LlmProvider, LlmResponse, LlmSectionRequest } from '../types';
import {
  normalizeOpenAIResponse,
  fetchWithTimeout,
} from '../response-normalizer';

export interface MinimaxModelConfig {
  modelId: string;
  contextTokens: number;
  maxOutputTokens: number;
}

export const MINIMAX_MODELS: Record<string, MinimaxModelConfig> = {
  'minimax-m2.1': {
    modelId: 'MiniMax-M2.1',
    contextTokens: 1000000,
    maxOutputTokens: 1000000,
  },
  'minimax-m2.1-lightning': {
    modelId: 'MiniMax-M2.1-lightning',
    contextTokens: 1000000,
    maxOutputTokens: 1000000,
  },
  'minimax-m2': {
    modelId: 'MiniMax-M2',
    contextTokens: 1000000,
    maxOutputTokens: 1000000,
  },
  'minimax-01': {
    modelId: 'MiniMax-Text-01',
    contextTokens: 4000000,
    maxOutputTokens: 4000000,
  },
};

export class MinimaxClient implements LlmProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.minimax.io/v1';

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
      MINIMAX_MODELS[options.model] || MINIMAX_MODELS['minimax-m2'];

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
          max_tokens:
            options.maxTokens ?? Math.min(modelConfig.maxOutputTokens, 4096),
          temperature: options.temperature ?? 0.7,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Minimax API error: ${error}`);
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

export function createMinimaxClient(apiKey: string): MinimaxClient {
  return new MinimaxClient(apiKey);
}
