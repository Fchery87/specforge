import { describe, it, expect } from 'vitest';
import { buildTransformedPrompts } from '../prompt-transformer';
import type { LlmSectionRequest } from '../types';

describe('PromptTransformer', () => {
  const mockRequest: LlmSectionRequest = {
    artifactType: 'Technical Specification',
    sectionName: 'Database Schema',
    sectionInstructions: 'Design a highly normalized relational schema.',
    sectionQuestions: ['What about caching?'],
    previousSections: [
      { name: 'Architecture Overview', content: 'We use PostgreSQL.' },
    ],
    projectContext: {
      title: 'SpecForge',
      description: 'An AI-driven documentation generator.',
    },
    modelId: 'gpt-4o',
  };

  it('formats Anthropic prompts with XML tags', () => {
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      mockRequest,
      'anthropic',
    );

    expect(systemPrompt).toContain('<role>');
    expect(systemPrompt).toContain('<previous_sections>');
    expect(systemPrompt).toContain('## Architecture Overview');
    expect(systemPrompt).toContain('<requirements>');
    expect(systemPrompt).toContain(
      'Design a highly normalized relational schema.',
    );
    expect(systemPrompt).toContain('<guidelines>');

    expect(userPrompt).toContain('<project>');
    expect(userPrompt).toContain('What about caching?');
  });

  it('formats DeepSeek/Minimax prompts with explicit Markdown structural headers', () => {
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      mockRequest,
      'deepseek',
    );

    expect(systemPrompt).toContain('# Context from previous sections');
    expect(systemPrompt).toContain('We use PostgreSQL.');
    expect(systemPrompt).toContain('# Current section requirements');
    expect(systemPrompt).toContain('Design a highly');
    expect(systemPrompt).toContain('# Guidelines');

    expect(userPrompt).toContain('Project: SpecForge');
    expect(userPrompt).toContain('- What about caching?');
    expect(userPrompt).toContain('Generate the section now:');
  });

  it('formats Default (OpenAI/Mistral) prompts with standard markdown paragraphs', () => {
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      mockRequest,
      'openai',
    );

    expect(systemPrompt).toContain('Context from previous sections:');
    expect(systemPrompt).toContain('We use PostgreSQL.');
    expect(systemPrompt).toContain('Current section requirements:');
    expect(systemPrompt).toContain('Guidelines:');

    expect(userPrompt).toContain('Project: SpecForge');
    expect(userPrompt).toContain('- What about caching?');
  });

  it('handles empty previous sections gracefully', () => {
    const emptyContextRequest = {
      ...mockRequest,
      previousSections: [],
      sectionQuestions: [],
    };
    const { systemPrompt, userPrompt } = buildTransformedPrompts(
      emptyContextRequest,
      'openai',
    );

    expect(systemPrompt).toContain('No previous sections.');
    expect(userPrompt).not.toContain('Answer these questions');
  });
});
