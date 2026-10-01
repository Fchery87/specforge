/**
 * Section Plans and Interactive Planning Types
 *
 * Defines the structure for section plans that allow users to preview
 * and customize what will be generated before starting generation.
 *
 * Phase 4 (P2) - Interactive Section Planning
 */

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
 * Calculates total estimated tokens for a set of section plans
 */
export function calculateTotalTokens(plans: SectionPlanConfig[]): number {
  return plans.reduce((total, plan) => total + plan.estimatedTokens, 0);
}

/**
 * Creates default user preferences for a set of section plans
 */
export function createDefaultPreferences(
  plans: SectionPlanConfig[],
): UserSectionPreference[] {
  return plans.map((plan) => ({
    sectionId: plan.id,
    enabled: plan.required, // Required sections are enabled by default
    customInstructions: undefined,
  }));
}

/**
 * Filters section plans based on user preferences
 */
export function filterSectionsByPreferences(
  plans: SectionPlanConfig[],
  preferences: UserSectionPreference[],
): SectionPlanConfig[] {
  const preferenceMap = new Map(preferences.map((p) => [p.sectionId, p]));

  return plans.filter((plan) => {
    const pref = preferenceMap.get(plan.id);
    // If no preference exists, default to enabled for required sections
    return pref?.enabled ?? plan.required;
  });
}

/**
 * Formats token count for display (e.g., "2.5K tokens")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Estimates cost based on token count (rough estimate: $0.002 per 1K tokens)
 */
export function estimateCost(tokens: number): string {
  const cost = (tokens / 1000) * 0.002;
  return `$${cost.toFixed(3)}`;
}
