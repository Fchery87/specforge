import { describe, it, expect } from 'vitest';
import { generateSectionContent } from '../actions/generatePhase';

describe('generateSectionContent', () => {
  it('rejects with No LLM credentials configured when llmClient is null', async () => {
    const dummyParams: Parameters<typeof generateSectionContent>[0] = {
      projectContext: {
        title: 'Test Project',
        description: 'Test Description',
        questions: '',
      },
      sectionName: 'Overview',
      sectionInstructions: 'Write an overview',
      sectionQuestions: [],
      previousSections: [],
      model: {
        id: 'gpt-4o',
        provider: 'openai',
        contextTokens: 128000,
        maxOutputTokens: 8192,
        defaultMax: 4096,
      },
      maxTokens: 1000,
      llmClient: null as unknown as ReturnType<
        typeof import('../../lib/llm/client-factory').createLlmClient
      >,
      providerInfo: 'openai/gpt-4o',
      phaseId: 'brief',
      constitution: null,
    };

    await expect(generateSectionContent(dummyParams)).rejects.toThrow(
      'No LLM credentials configured'
    );
  });
});
