export const SPECFORGE_VERSION = '2.0.0';

/**
 * Computes a content hash using a simple string hashing algorithm.
 * This works in both Node.js and browser environments.
 */
export function computeContentHash(content: string): string {
  // Simple hash function for browser compatibility
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and ensure positive
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  return hexHash + hexHash; // Double to get 16 chars
}

/**
 * Computes a prompt hash using a simple string hashing algorithm.
 * This works in both Node.js and browser environments.
 */
export function computePromptHash(
  systemPrompt: string,
  userPrompt: string,
): string {
  const combined = `${systemPrompt}\n---\n${userPrompt}`;
  return computeContentHash(combined);
}

export interface ProvenanceData {
  constitutionHash?: string;
  modelId: string;
  modelProvider: string;
  promptHash: string;
  temperature: number;
  generatedAt: number;
  specforgeVersion: string;
  parentArtifactIds?: string[];
}

export function buildProvenance(params: {
  modelId: string;
  modelProvider: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  constitutionContent?: string;
  parentArtifactIds?: string[];
}): ProvenanceData {
  return {
    constitutionHash: params.constitutionContent
      ? computeContentHash(params.constitutionContent)
      : undefined,
    modelId: params.modelId,
    modelProvider: params.modelProvider,
    promptHash: computePromptHash(params.systemPrompt, params.userPrompt),
    temperature: params.temperature,
    generatedAt: Date.now(),
    specforgeVersion: SPECFORGE_VERSION,
    parentArtifactIds: params.parentArtifactIds,
  };
}
