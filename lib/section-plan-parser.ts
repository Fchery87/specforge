export interface GeneratedSectionPlan {
  id: string;
  title: string;
  description: string;
  estimatedTokens: number;
  required: boolean;
  sectionType?: 'technical' | 'implementation' | 'planning' | 'documentation';
}

/**
 * Parses LLM response into structured section plans.
 * Handles both raw JSON and JSON wrapped in markdown code fences.
 */
export function parseSectionPlanResponse(raw: string): GeneratedSectionPlan[] {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSection);
  } catch {
    return [];
  }
}

function isValidSection(s: unknown): s is GeneratedSectionPlan {
  if (typeof s !== 'object' || s === null) return false;
  const obj = s as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.estimatedTokens === 'number' &&
    typeof obj.required === 'boolean'
  );
}
