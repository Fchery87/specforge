import type { PhaseId } from '../workflow';
import type { SectionPlanConfig } from '../llm/section-plans';

/**
 * One section a phase generates.
 *
 * `description` says what the section decides and is what the question prompt and the plan preview
 * show. `instructions` is what the generation prompt tells the model the section must cover.
 */
export interface PhaseSection extends SectionPlanConfig {
  instructions: string;
}

type SectionFields = Omit<PhaseSection, 'phaseId'>;

function forPhase(phaseId: PhaseId, sections: readonly SectionFields[]): readonly PhaseSection[] {
  return sections.map((section) => ({ ...section, phaseId }));
}

/** What each phase's document is for, in the words the question prompt uses. */
export const PHASE_PURPOSE: Record<PhaseId, string> = {
  constitution: 'Project Constitution: immutable standards and constraints governing the entire project',
  brief: 'Project Brief: high-level overview, problem statement, goals, and target audience',
  prd: 'Product Requirements Document: detailed requirements and success metrics',
  domainModel: 'Domain Model: core entities, relationships, state transitions, and invariants',
  specs: 'Technical Specifications: architecture, data models, API design, security, and deployment',
  stories: 'User Stories & Tasks: epics, user stories, and technical tasks',
  artifacts: 'Technical Artifacts: API documentation, database schemas, environment config, deployment guides',
  handoff: 'Project Handoff: summary, setup guide, and next steps',
};

/**
 * Every phase's sections, in the order they are generated.
 *
 * This is the only definition. Generation, the phase page, the stage reports, the budgets and the
 * question prompt all read it, so a section cannot be renamed in one place and left behind in
 * another, which is how the question prompt came to describe sections that were never generated.
 */
export const PHASE_SECTIONS: Record<PhaseId, readonly PhaseSection[]> = {
  constitution: forPhase('constitution', [
    {
      id: 'locked-constraints',
      title: 'Locked Constraints',
      description:
        'Define immutable truths including state invariants, domain rules, and non-negotiable security protocols.',
      instructions:
        'Define immutable truths including state invariants, domain rules, and non-negotiable security protocols.',
      estimatedTokens: 1500,
      required: true,
      sectionType: 'planning',
    },
    {
      id: 'architecture-decisions',
      title: 'Architecture Decisions',
      description:
        'Outline high-level architecture patterns, state management approaches, and API design principles.',
      instructions:
        'Outline high-level architecture patterns, state management approaches, and API design principles.',
      estimatedTokens: 1200,
      required: true,
      sectionType: 'technical',
    },
    {
      id: 'tech-stack',
      title: 'Tech Stack',
      description:
        'Specify frameworks, runtimes, databases, ORMs, and styling approaches with strict version constraints.',
      instructions:
        'Specify frameworks, runtimes, databases, ORMs, and styling approaches with strict version constraints.',
      estimatedTokens: 800,
      required: true,
      sectionType: 'technical',
    },
    {
      id: 'quality-and-standards',
      title: 'Quality & Standards',
      description:
        'Set non-negotiable requirements for accessibility (WCAG), performance, security, and test coverage.',
      instructions:
        'Set non-negotiable requirements for accessibility (WCAG), performance, security, and test coverage.',
      estimatedTokens: 1000,
      required: true,
      sectionType: 'documentation',
    },
  ]),
  brief: forPhase('brief', [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      description: 'Provide a concise overview of the project goals, target users, and key deliverables.',
      instructions: 'Provide a concise overview of the project goals, target users, and key deliverables.',
      estimatedTokens: 1000,
      required: true,
      sectionType: 'documentation',
    },
    {
      id: 'problem-and-objectives',
      title: 'Problem & Objectives',
      description:
        'Clearly articulate the problem this project solves and define specific, measurable goals with success criteria.',
      instructions:
        'Clearly articulate the problem this project solves and define specific, measurable goals with success criteria.',
      estimatedTokens: 1500,
      required: true,
      sectionType: 'planning',
    },
    {
      id: 'features-and-requirements',
      title: 'Features & Requirements',
      description:
        'Outline the core features, functionality required, and any technical constraints or compliance requirements.',
      instructions:
        'Outline the core features, functionality required, and any technical constraints or compliance requirements.',
      estimatedTokens: 2000,
      required: true,
      sectionType: 'planning',
    },
  ]),
  prd: forPhase('prd', [
    {
      id: 'executive-summary',
      title: 'Executive Summary',
      description: 'Provide a concise overview of the project goals, target users, and key deliverables.',
      instructions: 'Provide a concise overview of the project goals, target users, and key deliverables.',
      estimatedTokens: 1000,
      required: true,
      sectionType: 'documentation',
    },
    {
      id: 'requirements',
      title: 'Requirements',
      description: 'List all functional and non-functional requirements, organized by priority and category.',
      instructions: 'List all functional and non-functional requirements, organized by priority and category.',
      estimatedTokens: 2500,
      required: true,
      sectionType: 'documentation',
    },
    {
      id: 'success-metrics',
      title: 'Success Metrics',
      description:
        'Define key performance indicators (KPIs), metrics for success, and how they will be measured and tracked.',
      instructions:
        'Define key performance indicators (KPIs), metrics for success, and how they will be measured and tracked.',
      estimatedTokens: 1000,
      required: false,
      sectionType: 'planning',
    },
  ]),
  domainModel: forPhase('domainModel', [
    {
      id: 'domain-glossary',
      title: 'Ubiquitous Language & Domain Glossary',
      description:
        'Define canonical domain terms, boundary rules, and forbidden conflicting synonyms (CONTEXT.md style).',
      instructions:
        'Define canonical domain terms, precise business meanings, forbidden conflicting synonyms, and domain invariants.',
      estimatedTokens: 1200,
      required: true,
      sectionType: 'documentation',
    },
    {
      id: 'entity-definitions',
      title: 'Entity Definitions',
      description: 'Define core domain entities, their purpose, attributes, and invariants.',
      instructions: 'Define core domain entities, their purpose, attributes, and invariants.',
      estimatedTokens: 1500,
      required: true,
      sectionType: 'technical',
    },
    {
      id: 'entity-relationships',
      title: 'Entity Relationships',
      description: 'Describe cardinality and ownership relationships between entities.',
      instructions:
        'Describe cardinality and ownership relationships between entities. Include a valid Mermaid erDiagram code block showing all core entities, attributes, primary/foreign keys, and exact relationship cardinalities (e.g. ||--o{, ||--||).',
      estimatedTokens: 1200,
      required: false,
      sectionType: 'technical',
    },
    {
      id: 'state-transitions',
      title: 'State Transitions',
      description: 'Map entity lifecycle states, transitions, and governing business guards.',
      instructions:
        'Map entity lifecycle states, transitions, and governing business guards. Include a valid Mermaid stateDiagram-v2 code block detailing valid states, triggering events, transitions, and guard conditions.',
      estimatedTokens: 1500,
      required: true,
      sectionType: 'implementation',
    },
  ]),
  specs: forPhase('specs', [
    {
      id: 'architecture-overview',
      title: 'Architecture Overview',
      description: 'Describe the high-level system architecture, design patterns, and technology choices.',
      instructions:
        'Describe the high-level system architecture, design patterns, and technology choices. Include a valid Mermaid C4Context or flowchart LR architecture diagram illustrating components, client boundaries, services, databases, and third-party integrations.',
      estimatedTokens: 2000,
      required: true,
      sectionType: 'technical',
    },
    {
      id: 'deep-modules',
      title: 'Deep Module Interfaces',
      description:
        'Define deep modules with narrow, simple interfaces that conceal complex internal logic (Ousterhout). Specify inputs, outputs, error catalogs, and hidden complexity.',
      instructions:
        'Define deep modules with narrow, simple interfaces that conceal complex internal logic (Ousterhout). Specify inputs, outputs, error catalogs, and hidden complexity.',
      estimatedTokens: 2000,
      required: true,
      sectionType: 'technical',
    },
    {
      id: 'test-seams',
      title: 'Explicit Test Seams',
      description:
        'Identify key architectural seams (Feathers) where behavior varies and automated tests attach without modifying caller code.',
      instructions:
        'Identify key architectural seams (Feathers) where behavior varies and automated tests attach without modifying caller code. Provide explicit code snippets or interface contracts illustrating the seam boundaries.',
      estimatedTokens: 1500,
      required: true,
      sectionType: 'technical',
    },
    {
      id: 'data-models-and-api',
      title: 'Data Models & API Contracts',
      description:
        'Define core data structures, database schemas, and API endpoints with request/response schemas and error envelopes.',
      instructions:
        'Define core data structures and APIs with machine-readable precision. Provide complete database schema definitions (e.g. Prisma schema, Drizzle schema, or SQL DDL) with primary keys, foreign keys, and indexes. Provide formal OpenAPI 3.1 YAML contracts including request/response bodies, standard error envelopes, and HTTP status codes.',
      estimatedTokens: 4500,
      required: true,
      sectionType: 'technical',
    },
    {
      id: 'deployment-and-security',
      title: 'Deployment & Security',
      description:
        'Describe authentication, authorization, data protection, infrastructure, and the deployment pipeline.',
      instructions:
        'Describe deployment strategy, infrastructure, authentication, authorization, and security requirements.',
      estimatedTokens: 2700,
      required: true,
      sectionType: 'technical',
    },
  ]),
  stories: forPhase('stories', [
    {
      id: 'epic-overview',
      title: 'Epic Overview',
      description: 'Provide an overview of the main epics and how they relate to project goals.',
      instructions: 'Provide an overview of the main epics and how they relate to project goals.',
      estimatedTokens: 1000,
      required: true,
      sectionType: 'planning',
    },
    {
      id: 'user-stories',
      title: 'Tracer-Bullet User Stories',
      description:
        'List user stories as vertical tracer bullets (schema + API + UI + tests) with explicit **Blocked by:** dependencies, **Slice Type:**, and **Files to touch:**.',
      instructions:
        'List user stories as vertical tracer bullets (schema + API + UI + tests) with explicit **Blocked by:** dependencies, **Slice Type:** (tracer_bullet or wide_refactor), and **Files to touch:**.',
      estimatedTokens: 3000,
      required: true,
      sectionType: 'implementation',
    },
    {
      id: 'technical-tasks',
      title: 'Technical Tasks & DAG',
      description: 'Break down user stories into technical implementation tasks with topological dependency edges.',
      instructions:
        'Break down user stories into technical implementation tasks with dependencies and topological ordering.',
      estimatedTokens: 2500,
      required: true,
      sectionType: 'implementation',
    },
  ]),
  artifacts: forPhase('artifacts', [
    {
      id: 'documentation',
      title: 'Documentation',
      description: 'Generate API documentation and database schema documentation.',
      instructions: 'Generate API documentation and database schema documentation.',
      estimatedTokens: 4500,
      required: false,
      sectionType: 'documentation',
    },
    {
      id: 'configuration',
      title: 'Configuration',
      description: 'Document environment variables, configuration files, and infrastructure setup.',
      instructions: 'Provide configuration files and infrastructure setup.',
      estimatedTokens: 1500,
      required: true,
      sectionType: 'technical',
    },
    {
      id: 'deployment-guide',
      title: 'Deployment Guide',
      description: 'Provide step-by-step deployment instructions and deployment scripts.',
      instructions: 'Create step-by-step deployment instructions.',
      estimatedTokens: 1800,
      required: false,
      sectionType: 'implementation',
    },
  ]),
  handoff: forPhase('handoff', [
    {
      id: 'project-summary',
      title: 'Project Summary',
      description: 'Summarize the project structure, key files, and architecture.',
      instructions: 'Summarize the project structure, key files, and architecture.',
      estimatedTokens: 1500,
      required: true,
      sectionType: 'documentation',
    },
    {
      id: 'setup-guide',
      title: 'Setup Guide',
      description: 'Provide environment setup and development guide instructions.',
      instructions: 'Provide environment setup and development guide instructions.',
      estimatedTokens: 2000,
      required: true,
      sectionType: 'documentation',
    },
    {
      id: 'next-steps',
      title: 'Next Steps',
      description: 'List recommended next steps and priorities for development.',
      instructions: 'List recommended next steps and priorities for development.',
      estimatedTokens: 1000,
      required: false,
      sectionType: 'planning',
    },
  ]),
};

/** A phase's sections, or none for an id that is not a phase. */
export function sectionsFor(phaseId: string): readonly PhaseSection[] {
  return PHASE_SECTIONS[phaseId as PhaseId] ?? [];
}

export function sectionIdsFor(phaseId: string): readonly string[] {
  return sectionsFor(phaseId).map((section) => section.id);
}

/** What one section must cover, for the generation prompt. */
export function sectionInstructionsFor(phaseId: string, sectionId: string): string {
  return (
    sectionsFor(phaseId).find((section) => section.id === sectionId)?.instructions ??
    `Generate comprehensive content for the ${sectionId} section.`
  );
}
