import type { SectionPlanConfig } from '../../llm/section-plans';

/**
 * A six-section PRD plan for exercising the stage report, which measures any plan it is given.
 * It is a fixture rather than the registry's PRD so the report's tests do not move when a phase's
 * generated sections do.
 */
export const PRD_SECTIONS: SectionPlanConfig[] = [
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    description:
      'Provide a concise overview of the project goals, target users, and key deliverables.',
    estimatedTokens: 1000,
    required: true,
    phaseId: 'prd',
    sectionType: 'documentation',
  },
  {
    id: 'problem-statement',
    title: 'Problem Statement',
    description:
      'Clearly articulate the problem space, current challenges, pain points, and why this project is necessary.',
    estimatedTokens: 1500,
    required: true,
    phaseId: 'prd',
    sectionType: 'documentation',
  },
  {
    id: 'goals-and-objectives',
    title: 'Goals & Objectives',
    description:
      'Define specific, measurable, achievable, relevant, and time-bound (SMART) goals and success criteria.',
    estimatedTokens: 1200,
    required: true,
    phaseId: 'prd',
    sectionType: 'planning',
  },
  {
    id: 'user-personas',
    title: 'User Personas',
    description:
      'Describe the target user personas, their characteristics, goals, pain points, and how they will interact with the product.',
    estimatedTokens: 1800,
    required: false,
    phaseId: 'prd',
    sectionType: 'planning',
  },
  {
    id: 'requirements',
    title: 'Requirements',
    description:
      'List all functional and non-functional requirements, organized by priority and category.',
    estimatedTokens: 2500,
    required: true,
    phaseId: 'prd',
    sectionType: 'documentation',
  },
  {
    id: 'success-metrics',
    title: 'Success Metrics',
    description:
      'Define key performance indicators (KPIs), metrics for success, and how they will be measured and tracked.',
    estimatedTokens: 1000,
    required: false,
    phaseId: 'prd',
    sectionType: 'planning',
  },
];
