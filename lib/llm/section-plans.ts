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
  sectionType: "documentation" | "technical" | "implementation" | "planning";
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

// ============================================================================
// SECTION PLANS BY PHASE
// ============================================================================

/**
 * Brief phase sections
 */
export const BRIEF_SECTIONS: SectionPlanConfig[] = [
  {
    id: "problem-and-objectives",
    title: "Problem & Objectives",
    description: "Clearly articulate the problem this project solves and define specific, measurable goals with success criteria.",
    estimatedTokens: 1500,
    required: true,
    phaseId: "brief",
    sectionType: "planning",
  },
  {
    id: "features-and-requirements",
    title: "Features & Requirements",
    description: "Outline the core features, functionality required, and any technical constraints or compliance requirements.",
    estimatedTokens: 2000,
    required: true,
    phaseId: "brief",
    sectionType: "planning",
  },
  {
    id: "target-audience",
    title: "Target Audience",
    description: "Define who will use this product and their key characteristics.",
    estimatedTokens: 800,
    required: false,
    phaseId: "brief",
    sectionType: "planning",
  },
];

/**
 * PRD phase sections
 */
export const PRD_SECTIONS: SectionPlanConfig[] = [
  {
    id: "executive-summary",
    title: "Executive Summary",
    description: "Provide a concise overview of the project goals, target users, and key deliverables.",
    estimatedTokens: 1000,
    required: true,
    phaseId: "prd",
    sectionType: "documentation",
  },
  {
    id: "problem-statement",
    title: "Problem Statement",
    description: "Clearly articulate the problem space, current challenges, pain points, and why this project is necessary.",
    estimatedTokens: 1500,
    required: true,
    phaseId: "prd",
    sectionType: "documentation",
  },
  {
    id: "goals-and-objectives",
    title: "Goals & Objectives",
    description: "Define specific, measurable, achievable, relevant, and time-bound (SMART) goals and success criteria.",
    estimatedTokens: 1200,
    required: true,
    phaseId: "prd",
    sectionType: "planning",
  },
  {
    id: "user-personas",
    title: "User Personas",
    description: "Describe the target user personas, their characteristics, goals, pain points, and how they will interact with the product.",
    estimatedTokens: 1800,
    required: false,
    phaseId: "prd",
    sectionType: "planning",
  },
  {
    id: "requirements",
    title: "Requirements",
    description: "List all functional and non-functional requirements, organized by priority and category.",
    estimatedTokens: 2500,
    required: true,
    phaseId: "prd",
    sectionType: "documentation",
  },
  {
    id: "success-metrics",
    title: "Success Metrics",
    description: "Define key performance indicators (KPIs), metrics for success, and how they will be measured and tracked.",
    estimatedTokens: 1000,
    required: false,
    phaseId: "prd",
    sectionType: "planning",
  },
];

/**
 * Specifications phase sections
 */
export const SPECIFICATIONS_SECTIONS: SectionPlanConfig[] = [
  {
    id: "architecture-overview",
    title: "Architecture Overview",
    description: "Describe the high-level system architecture, design patterns, and technology choices.",
    estimatedTokens: 2000,
    required: true,
    phaseId: "specs",
    sectionType: "technical",
  },
  {
    id: "tech-stack",
    title: "Tech Stack",
    description: "Detail the technologies, frameworks, libraries, and versions to be used.",
    estimatedTokens: 1500,
    required: true,
    phaseId: "specs",
    sectionType: "technical",
  },
  {
    id: "data-models",
    title: "Data Models",
    description: "Define core data structures, entities, relationships, and database schema.",
    estimatedTokens: 2000,
    required: false,
    phaseId: "specs",
    sectionType: "technical",
  },
  {
    id: "api-design",
    title: "API Design",
    description: "Document REST/GraphQL endpoints, request/response schemas, and authentication.",
    estimatedTokens: 2500,
    required: false,
    phaseId: "specs",
    sectionType: "technical",
  },
  {
    id: "component-architecture",
    title: "Component Architecture",
    description: "Define the component hierarchy, composition patterns, and state management approach.",
    estimatedTokens: 1800,
    required: false,
    phaseId: "specs",
    sectionType: "technical",
  },
  {
    id: "security-considerations",
    title: "Security Considerations",
    description: "Describe authentication, authorization, data protection, and security best practices.",
    estimatedTokens: 1500,
    required: true,
    phaseId: "specs",
    sectionType: "technical",
  },
  {
    id: "deployment-strategy",
    title: "Deployment Strategy",
    description: "Outline infrastructure, CI/CD pipeline, and deployment procedures.",
    estimatedTokens: 1200,
    required: false,
    phaseId: "specs",
    sectionType: "technical",
  },
];

/**
 * User Stories phase sections
 */
export const USER_STORIES_SECTIONS: SectionPlanConfig[] = [
  {
    id: "epic-overview",
    title: "Epic Overview",
    description: "Provide an overview of the main epics and how they relate to project goals.",
    estimatedTokens: 1000,
    required: true,
    phaseId: "stories",
    sectionType: "planning",
  },
  {
    id: "user-stories",
    title: "User Stories",
    description: "List user stories with acceptance criteria in proper format (As a... I want... So that...).",
    estimatedTokens: 3000,
    required: true,
    phaseId: "stories",
    sectionType: "implementation",
  },
  {
    id: "technical-tasks",
    title: "Technical Tasks",
    description: "Break down user stories into technical implementation tasks with dependencies.",
    estimatedTokens: 2500,
    required: true,
    phaseId: "stories",
    sectionType: "implementation",
  },
  {
    id: "acceptance-criteria",
    title: "Acceptance Criteria",
    description: "Define detailed acceptance criteria for each user story.",
    estimatedTokens: 2000,
    required: false,
    phaseId: "stories",
    sectionType: "implementation",
  },
];

/**
 * Artifacts phase sections
 */
export const ARTIFACTS_SECTIONS: SectionPlanConfig[] = [
  {
    id: "api-documentation",
    title: "API Documentation",
    description: "Generate comprehensive API documentation with examples.",
    estimatedTokens: 2500,
    required: false,
    phaseId: "artifacts",
    sectionType: "documentation",
  },
  {
    id: "database-schema",
    title: "Database Schema",
    description: "Document the database schema with tables, columns, indexes, and relationships.",
    estimatedTokens: 2000,
    required: false,
    phaseId: "artifacts",
    sectionType: "technical",
  },
  {
    id: "environment-config",
    title: "Environment Configuration",
    description: "Document environment variables, configuration files, and setup instructions.",
    estimatedTokens: 1500,
    required: true,
    phaseId: "artifacts",
    sectionType: "technical",
  },
  {
    id: "deployment-scripts",
    title: "Deployment Scripts",
    description: "Provide deployment scripts and infrastructure as code.",
    estimatedTokens: 1800,
    required: false,
    phaseId: "artifacts",
    sectionType: "implementation",
  },
];

/**
 * Handoff phase sections
 */
export const HANDOFF_SECTIONS: SectionPlanConfig[] = [
  {
    id: "project-summary",
    title: "Project Summary",
    description: "Summarize the project structure, key files, and architecture.",
    estimatedTokens: 1500,
    required: true,
    phaseId: "handoff",
    sectionType: "documentation",
  },
  {
    id: "setup-guide",
    title: "Setup Guide",
    description: "Provide environment setup and development guide instructions.",
    estimatedTokens: 2000,
    required: true,
    phaseId: "handoff",
    sectionType: "documentation",
  },
  {
    id: "implementation-guide",
    title: "Implementation Guide",
    description: "Step-by-step guide for implementing the project.",
    estimatedTokens: 2500,
    required: true,
    phaseId: "handoff",
    sectionType: "implementation",
  },
  {
    id: "next-steps",
    title: "Next Steps",
    description: "List recommended next steps and priorities for development.",
    estimatedTokens: 1000,
    required: false,
    phaseId: "handoff",
    sectionType: "planning",
  },
];

/**
 * All section plans organized by phase
 */
export const SECTION_PLANS_BY_PHASE: SectionPlansByPhase = {
  brief: BRIEF_SECTIONS,
  prd: PRD_SECTIONS,
  specs: SPECIFICATIONS_SECTIONS,
  stories: USER_STORIES_SECTIONS,
  artifacts: ARTIFACTS_SECTIONS,
  handoff: HANDOFF_SECTIONS,
};

/**
 * Gets section plans for a specific phase
 */
export function getSectionPlansForPhase(phaseId: string): SectionPlanConfig[] {
  return SECTION_PLANS_BY_PHASE[phaseId] || [];
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
export function createDefaultPreferences(plans: SectionPlanConfig[]): UserSectionPreference[] {
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
  preferences: UserSectionPreference[]
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
