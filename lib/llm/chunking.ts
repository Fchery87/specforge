import type { LlmModel, SectionPlan } from './types';

export function getSectionPlan(
  artifactType: string,
  phaseId?: string
): string[] {
  // NOTE: Reduced section counts to 3 max to fit within Convex action timeout
  // Reasoning models (GLM-4.7, etc.) need significant time per section
  // Generating more sections can be done in subsequent iterations
  switch (artifactType) {
    case 'prd':
    case 'brief':
      return [
        'executive-summary',
        'problem-and-objectives',
        'features-and-requirements',
      ];
    case 'spec':
    case 'specs':
      return [
        'architecture-overview',
        'data-models-and-api',
        'deployment-and-security',
      ];
    case 'stories':
      return ['epic-overview', 'user-stories', 'technical-tasks'];
    case 'artifacts':
      return ['documentation', 'configuration', 'deployment-guide'];
    case 'handoff':
      return ['project-summary', 'setup-guide', 'next-steps'];
    case 'doc':
      return ['introduction', 'main-content', 'conclusion'];
    default:
      return ['content'];
  }
}

export function planSections(
  model: LlmModel,
  sectionNames: string[],
  safetyRatio = 0.5
): SectionPlan[] {
  const cap = Math.max(256, Math.floor(model.maxOutputTokens * safetyRatio));
  const per = Math.max(256, Math.floor(cap / Math.max(1, sectionNames.length)));
  return sectionNames.map((name) => ({
    name,
    maxTokens: per,
  }));
}

export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

export function splitLargeSection(
  content: string,
  maxTokens: number,
  model: LlmModel
): string[] {
  const estimatedTokens = estimateTokenCount(content);

  if (estimatedTokens <= maxTokens) {
    return [content];
  }

  // Split by paragraphs or sections
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokenCount(para);

    if (currentTokens + paraTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
      currentTokens = paraTokens;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export function calculateOptimalChunkSize(
  totalContentTokens: number,
  model: LlmModel,
  sectionCount: number,
  safetyRatio = 0.4
): number {
  const availableTokens = model.maxOutputTokens * safetyRatio;
  const tokensPerSection = Math.floor(availableTokens / sectionCount);
  return Math.min(tokensPerSection, Math.floor(model.maxOutputTokens * 0.8));
}

export function mergeSectionContent(
  sections: Array<{ name: string; content: string }>,
  separator = '\n\n'
): string {
  return sections.map((s) => `## ${s.name}\n\n${s.content}`).join(separator);
}

export function validateSectionPlan(
  plan: SectionPlan[],
  model: LlmModel
): SectionPlan[] {
  return plan.map((section) => ({
    ...section,
    maxTokens: Math.min(section.maxTokens, model.maxOutputTokens - 500),
  }));
}

export const FALLBACK_MODELS: LlmModel[] = [
  {
    id: 'openai-gpt-4o',
    provider: 'openai',
    contextTokens: 128000,
    maxOutputTokens: 16384,
    defaultMax: 8000,
  },
  {
    id: 'anthropic-claude-3-5-sonnet',
    provider: 'anthropic',
    contextTokens: 200000,
    maxOutputTokens: 8192,
    defaultMax: 4000,
  },
  {
    id: 'mistral-large',
    provider: 'mistral',
    contextTokens: 32000,
    maxOutputTokens: 4096,
    defaultMax: 2000,
  },
];
