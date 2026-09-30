import type { LlmModel, SectionPlan } from './types';

export function planSections(
  model: LlmModel,
  sectionNames: string[],
  safetyRatio = 0.5,
): SectionPlan[] {
  const cap = Math.max(256, Math.floor(model.maxOutputTokens * safetyRatio));
  const per = Math.max(256, Math.floor(cap / Math.max(1, sectionNames.length)));
  return sectionNames.map((name) => ({
    name,
    maxTokens: per,
  }));
}

export function expandSectionsForBudget({
  sectionNames,
  estimatedTokens,
  maxTokensPerSection,
}: {
  sectionNames: string[];
  estimatedTokens: number;
  maxTokensPerSection: number;
}): string[] {
  if (sectionNames.length !== 1) return sectionNames;
  const needed = Math.max(1, Math.ceil(estimatedTokens / maxTokensPerSection));
  if (needed === 1) return sectionNames;
  return Array.from(
    { length: needed },
    (_, i) => `${sectionNames[0]}-part-${i + 1}`,
  );
}

export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token on average
  return Math.ceil(text.length / 4);
}

export function splitLargeSection(
  content: string,
  maxTokens: number,
  model: LlmModel,
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
  safetyRatio = 0.4,
): number {
  const availableTokens = model.maxOutputTokens * safetyRatio;
  const tokensPerSection = Math.floor(availableTokens / sectionCount);
  return Math.min(tokensPerSection, Math.floor(model.maxOutputTokens * 0.8));
}

export function mergeSectionContent(
  sections: Array<{ name: string; content: string }>,
  separator = '\n\n',
): string {
  return sections
    .map((s) => `## ${formatSectionName(s.name)}\n\n${s.content}`)
    .join(separator);
}

function formatSectionName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function validateSectionPlan(
  plan: SectionPlan[],
  model: LlmModel,
): SectionPlan[] {
  return plan.map((section) => ({
    ...section,
    maxTokens: Math.min(section.maxTokens, model.maxOutputTokens - 500),
  }));
}

export const FALLBACK_MODELS: LlmModel[] = [
  {
    id: 'gpt-4o',
    provider: 'openai',
    contextTokens: 128000,
    maxOutputTokens: 16384,
    defaultMax: 8000,
    enabled: true,
  },
  {
    id: 'claude-sonnet-4-5',
    provider: 'anthropic',
    contextTokens: 200000,
    maxOutputTokens: 8192,
    defaultMax: 4000,
    enabled: true,
  },
  {
    id: 'mistral-large-3',
    provider: 'mistral',
    contextTokens: 256000,
    maxOutputTokens: 8192,
    defaultMax: 4000,
    enabled: true,
  },
];
