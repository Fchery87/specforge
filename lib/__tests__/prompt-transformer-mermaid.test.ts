import { describe, test, expect, vi } from 'vitest';
import * as providerCapabilities from '../llm/provider-capabilities';
import { buildTransformedPrompts } from '../llm/prompt-transformer';
import type { LlmSectionRequest } from '../llm/types';

const baseRequest: LlmSectionRequest = {
  artifactType: 'prd',
  sectionName: 'Overview',
  sectionInstructions: 'Describe the product',
  sectionQuestions: [],
  previousSections: [],
  projectContext: { title: 'My App', description: 'A test app' },
  modelId: 'test-model',
};

describe('buildTransformedPrompts mermaid guideline', () => {
  test('XML format (anthropic) system prompt includes mermaid guideline', () => {
    const { systemPrompt } = buildTransformedPrompts(baseRequest, 'anthropic');
    expect(systemPrompt).toContain('Mermaid');
    expect(systemPrompt).toContain('```mermaid');
  });

  test('markdown format system prompt includes mermaid guideline', () => {
    const { systemPrompt } = buildTransformedPrompts(baseRequest, 'openai');
    expect(systemPrompt).toContain('Mermaid');
    expect(systemPrompt).toContain('```mermaid');
  });

  test('default format (plain capabilities) system prompt includes mermaid guideline', () => {
    vi.spyOn(providerCapabilities, 'getCapabilities').mockReturnValueOnce({
      supportsXmlTags: false,
      contextFormat: 'plaintext',
      prefersMarkdownStructure: false,
      supportsSystemRole: true,
      supportsChainOfThought: false,
      maxSystemPromptTokens: 4096,
    });
    const { systemPrompt } = buildTransformedPrompts(baseRequest, 'any-provider');
    expect(systemPrompt).toContain('Mermaid');
    expect(systemPrompt).toContain('```mermaid');
  });
});
