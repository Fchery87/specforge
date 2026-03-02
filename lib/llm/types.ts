export interface LlmProvider {
  complete(
    prompt: string,
    options: {
      model: string;
      maxTokens?: number;
      temperature?: number;
      /** When provided, sent as role:system message. prompt becomes role:user only. */
      systemPrompt?: string;
    },
  ): Promise<LlmResponse>;

  generateSection(
    request: LlmSectionRequest,
  ): Promise<{ content: string; tokens: number }>;
  isAvailable(): boolean;
}

export interface LlmResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LlmSectionRequest {
  projectContext: {
    title: string;
    description: string;
    [key: string]: string;
  };
  sectionName: string;
  sectionInstructions?: string;
  sectionQuestions: string[];
  previousSections: Array<{
    name: string;
    content: string;
  }>;
  artifactType: string;
  modelId: string;
  maxTokens?: number;
}

export interface LlmModel {
  id: string;
  provider: string;
  contextTokens: number;
  maxOutputTokens: number;
  defaultMax: number;
  enabled?: boolean;
}

export interface SectionPlan {
  name: string;
  maxTokens: number;
  tokensUsed?: number;
  model?: string;
}

export interface UserConfig {
  userId: string;
  provider: string;
  apiKey?: string;
  defaultModel: string;
  useSystem: boolean;
  systemKeyId?: string;
  zaiEndpointType?: 'paid' | 'coding';
  zaiIsChina?: boolean;
}

export interface ProviderCredentials {
  provider: string;
  apiKey: string;
  modelId: string;
  zaiEndpointType?: 'paid' | 'coding';
  zaiIsChina?: boolean;
}

// ============================================================================
// Critique / Self-Critique Types (Phase 2 P1 - Recursive Self-Critique)
// ============================================================================

/**
 * Result of a critique operation
 */
export interface CritiqueResult {
  passes: boolean;
  score: number; // 0-100
  summary: string;
  violations: Violation[];
  refinedSection?: string;
}

/**
 * Individual violation found during critique
 */
export interface Violation {
  category:
    | 'accessibility'
    | 'performance'
    | 'security'
    | 'architecture'
    | 'completeness';
  severity: 'critical' | 'warning' | 'info';
  criterion: string;
  issue: string;
  location?: string;
  suggestion: string;
}

/**
 * Configuration for critique behavior
 */
export interface CritiqueConfig {
  enabled: boolean;
  maxRetries: number;
  passThreshold: number; // Minimum score to pass (0-100)
  categories: {
    accessibility: boolean;
    performance: boolean;
    security: boolean;
    architecture: boolean;
    completeness: boolean;
  };
}

/**
 * Default critique configuration
 */
export const DEFAULT_CRITIQUE_CONFIG: CritiqueConfig = {
  enabled: true,
  maxRetries: 2,
  passThreshold: 80,
  categories: {
    accessibility: true,
    performance: true,
    security: true,
    architecture: true,
    completeness: true,
  },
};

// ============================================================================
// Section Plan / Interactive Planning Types (Phase 4 P2)
// ============================================================================

/**
 * Extended section plan with UI metadata for interactive planning
 */
export interface SectionPlanConfig {
  id: string;
  title: string;
  description: string;
  estimatedTokens: number;
  required: boolean;
  phaseId: string;
  sectionType: 'documentation' | 'technical' | 'implementation' | 'planning';
}

/**
 * User preferences for a section
 */
export interface UserSectionPreference {
  sectionId: string;
  enabled: boolean;
  customInstructions?: string;
}

/**
 * Complete section plan with user preferences applied
 */
export interface SectionPlanWithPreferences {
  section: SectionPlanConfig;
  preference: UserSectionPreference;
  totalEstimatedTokens: number;
}

/**
 * Section plans organized by phase
 */
export type SectionPlansByPhase = Record<string, SectionPlanConfig[]>;
