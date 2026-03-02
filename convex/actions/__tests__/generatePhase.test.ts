import { describe, it, expect } from 'vitest';
import {
  extractRelevantQuestions,
  generateSectionContent,
  planSectionsForPhase,
  stripLeadingHeading,
  sanitizeGeneratedContent,
} from '../generatePhase';

describe('generatePhase helpers', () => {
  it('matches architecture-overview questions', () => {
    const questions = [
      { text: 'Describe the architecture', answer: 'A' },
      { text: 'Unrelated', answer: 'B' },
    ];
    const result = extractRelevantQuestions(
      questions as any,
      'architecture-overview',
    );
    expect(result.length).toBe(1);
  });

  it('matches data-models-and-api questions', () => {
    const questions = [
      { text: 'Data model and schema?', answer: 'A' },
      { text: 'Unrelated', answer: 'B' },
    ];
    const result = extractRelevantQuestions(
      questions as any,
      'data-models-and-api',
    );
    expect(result.length).toBe(1);
  });

  it('strips leading headings from content', () => {
    const content = '## Architecture Overview\n\nDetails here';
    expect(stripLeadingHeading(content)).toBe('Details here');
  });

  it('continues when the model truncates output', async () => {
    const responses = [
      { content: 'Part 1', finishReason: 'length' },
      { content: 'Part 2', finishReason: 'stop' },
    ];
    const llmClient = {
      complete: async () => responses.shift(),
    } as any;

    const result = await generateSectionContent({
      projectContext: { title: 'T', description: 'D', questions: '' },
      sectionName: 'test',
      sectionInstructions: '',
      sectionQuestions: [],
      previousSections: [],
      model: {
        id: 'm',
        provider: 'openai',
        contextTokens: 1,
        maxOutputTokens: 2000,
        defaultMax: 1000,
      },
      maxTokens: 2000,
      llmClient,
      providerInfo: '',
      phaseId: 'brief',
      constitution: null,
    });

    expect(result.content).toContain('Part 1');
    expect(result.content).toContain('Part 2');
    expect(result.continued).toBe(true);
  });

  it('expands section plan when budget is too small', () => {
    const plan = planSectionsForPhase({
      sectionNames: ['architecture-overview'],
      estimatedTokens: 12000,
      model: {
        id: 'm',
        provider: 'openai',
        contextTokens: 1,
        maxOutputTokens: 4000,
        defaultMax: 2000,
      },
    });

    expect(plan.length).toBe(4);
  });
});

describe('sanitizeGeneratedContent', () => {
  it('strips numbered bold analysis headers', () => {
    const content = `1. **Analyze the Request:** The user wants a constitution document.\n\n## Locked Constraints\n\nAll state must be valid.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Locked Constraints');
    expect(result).toContain('All state must be valid.');
    expect(result).not.toContain('Analyze the Request');
  });

  it('strips Draft thought blocks', () => {
    const content = `*Draft thought about how to structure this section*\n\n## Architecture Decisions\n\nWe use Clean Architecture.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Architecture Decisions');
    expect(result).not.toContain('Draft thought');
  });

  it('strips self-referential reasoning lines', () => {
    const content = `The user wants me to generate a tech stack section.\nLet me think about what frameworks to recommend.\n\n## Tech Stack\n\n- React 19`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Tech Stack');
    expect(result).toContain('- React 19');
    expect(result).not.toContain('The user wants me to');
    expect(result).not.toContain('Let me think');
  });

  it('strips reasoning preambles', () => {
    const content = `Okay, let's break this down into components.\n\n## Quality Standards\n\nWCAG 2.2 AA compliance required.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Quality Standards');
    expect(result).not.toContain("Okay, let's break");
  });

  it('passes through clean document content unchanged', () => {
    const content = `## Locked Constraints\n\n- All PII must be encrypted at rest\n- RBAC enforced on all endpoints\n\n## Architecture\n\nClean Architecture with hexagonal design.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toBe(content);
  });

  it('collapses excessive blank lines after removal', () => {
    const content = `I need to analyze this carefully.\n\n\n\n\n\n## Section\n\nContent here.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).not.toMatch(/\n{4,}/);
    expect(result).toContain('## Section');
  });

  // ── Provider-specific patterns ──

  it('strips Claude/DeepSeek <thinking> XML blocks', () => {
    const content = `<thinking>Let me analyze what the user needs for this architecture section. I should consider the constraints and tech stack requirements.</thinking>\n\n## Architecture Overview\n\nThe system uses Clean Architecture with a hexagonal design pattern.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Architecture Overview');
    expect(result).toContain('Clean Architecture');
    expect(result).not.toContain('<thinking>');
    expect(result).not.toContain('</thinking>');
    expect(result).not.toContain('Let me analyze');
  });

  it('strips <think> tags (DeepSeek R1 style)', () => {
    const content = `<think>I need to structure this as a proper tech spec document with all the required sections.</think>\n\n## Tech Stack\n\n- React 19\n- TypeScript 5.3`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Tech Stack');
    expect(result).not.toContain('<think>');
  });

  it('strips **Thinking:** bold header blocks', () => {
    const content = `**Thinking:**\nI should focus on the security aspects first, then move to performance requirements.\n\n## Quality Standards\n\nWCAG 2.2 AA compliance is required.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Quality Standards');
    expect(result).not.toContain('**Thinking:**');
    expect(result).not.toContain('I should focus on');
  });

  it('strips "Here\'s my plan:" meta-commentary preambles', () => {
    const content = `Here's my plan:\n\n## Deployment Strategy\n\nThe application will be deployed to Vercel.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Deployment Strategy');
    expect(result).not.toContain("Here's my plan:");
  });

  it('strips numbered reasoning steps (Step 1: Analyze...)', () => {
    const content = `Step 1: Analyze the project requirements carefully.\nStep 2: Consider the tech stack constraints.\n\n## Data Models\n\nThe core entities are User, Project, and Artifact.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Data Models');
    expect(result).not.toContain('Step 1: Analyze');
    expect(result).not.toContain('Step 2: Consider');
  });

  it('strips [Internal] bracketed reasoning markers', () => {
    const content = `[Internal] This section needs to cover security protocols thoroughly.\n\n## Security Requirements\n\nAll data must be encrypted at rest.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Security Requirements');
    expect(result).not.toContain('[Internal]');
  });

  it('strips expanded self-referential patterns', () => {
    const content = `I'll structure this as a comprehensive overview of the architecture.\nI should focus on the key components.\nBased on the analysis above, here are the results.\n\n## Architecture\n\nMicroservices pattern.`;
    const result = sanitizeGeneratedContent(content);
    expect(result).toContain('## Architecture');
    expect(result).not.toContain("I'll structure this");
    expect(result).not.toContain('I should focus');
    expect(result).not.toContain('Based on the analysis');
  });
});
