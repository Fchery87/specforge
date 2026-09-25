'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import { selectEnabledModels } from '../../lib/llm/model-select';
import {
  resolveCredentials,
  resolveModelForCredentials,
  getFirstEnabledModelForProvider,
} from '../../lib/llm/registry';
import type { SystemCredential } from '../../lib/llm/registry';
import { createLlmClient } from '../../lib/llm/client-factory';
import { LLM_DEFAULTS } from '../../lib/llm/response-normalizer';
import { retryWithBackoff } from '../../lib/llm/retry';
import { rateLimiter } from '../rateLimiter';
import { logTelemetry } from '../../lib/llm/telemetry';
import { fetchModelDirectory } from '../../lib/llm/model-directory';
import { PHASE_DEPENDENCIES } from '../../lib/specification/dependency-graph';

const PHASE_QUESTIONS: Record<
  string,
  Array<{ text: string; required?: boolean }>
> = {
  constitution: [
    {
      text: 'What are the absolute immutable truths and constraints of this project?',
      required: true,
    },
    {
      text: 'What high-level architecture pattern must be followed?',
      required: true,
    },
    {
      text: 'What is the exact tech stack and version requirements?',
      required: true,
    },
    { text: 'What are the non-negotiable security protocols?' },
    {
      text: 'What defines the quality metrics and accessibility standards (e.g. WCAG)?',
    },
  ],
  brief: [
    {
      text: 'What is the primary goal of this project? What problem does it solve?',
      required: true,
    },
    {
      text: 'Who are the target users or audience for this product?',
      required: true,
    },
    {
      text: 'What are the key features or functionalities you want to include?',
      required: true,
    },
    {
      text: 'Are there any specific technical constraints or requirements? (e.g., integrations, compliance)',
    },
    { text: 'What is your expected timeline or deadline for launch?' },
    {
      text: 'Do you have any existing documentation, competitor analysis, or reference materials?',
    },
    { text: 'What defines success for this project? Key metrics or outcomes?' },
  ],
  prd: [
    {
      text: 'What is the primary goal of this product and who is it for?',
      required: true,
    },
    { text: 'What problem does this solve, and why now?' },
    { text: 'What are the key user journeys or workflows?' },
    { text: 'What are the must-have vs nice-to-have requirements?' },
    { text: 'How will success be measured (KPIs/metrics)?' },
  ],
  domainModel: [
    {
      text: 'What are the core entities that make up this domain?',
      required: true,
    },
    {
      text: 'How do these entities relate to each other (ownership, cardinality)?',
    },
    { text: 'What are the primary state transitions for the core entities?' },
    { text: 'Are there any strict invariants that data must always respect?' },
  ],
  specs: [
    {
      text: 'What architectural style do you prefer? (e.g., REST, GraphQL, gRPC)',
    },
    {
      text: 'Do you have preferred cloud providers or infrastructure requirements?',
    },
    { text: 'What are the expected scale and performance requirements?' },
    {
      text: 'Do you need real-time features, and if so, what kind? (e.g., websockets, server-sent events)',
    },
    { text: 'What authentication and authorization requirements exist?' },
    { text: 'Are there specific data models or database preferences?' },
  ],
  stories: [
    { text: 'What is your preferred sprint or iteration length?' },
    { text: 'Are there features that must be in the MVP versus nice-to-have?' },
    { text: 'Do you have any user research or personas to share?' },
    { text: 'What edge cases or error states should be handled?' },
  ],
  artifacts: [
    {
      text: 'What additional artifacts do you need beyond the standard deliverables?',
    },
    {
      text: 'Do you need API documentation, database schemas, or deployment guides?',
    },
  ],
  handoff: [
    { text: 'Who are the developers or team members receiving this handoff?' },
    { text: 'Are there specific coding standards or conventions to follow?' },
    { text: 'What environment setup or credentials need to be documented?' },
  ],
};

const PHASE_QUESTION_RANGE: Record<string, { min: number; max: number }> = {
  constitution: { min: 4, max: 6 },
  brief: { min: 5, max: 8 },
  prd: { min: 5, max: 8 },
  domainModel: { min: 4, max: 6 },
  specs: { min: 5, max: 8 },
  stories: { min: 4, max: 6 },
  artifacts: { min: 3, max: 5 },
  handoff: { min: 3, max: 5 },
};

const PHASE_CONTEXT: Record<string, { description: string; sections: string[] }> = {
  constitution: {
    description: 'Project Constitution — immutable standards and constraints governing the entire project',
    sections: ['locked-constraints', 'architecture-decisions', 'tech-stack', 'quality-and-standards'],
  },
  brief: {
    description: 'Project Brief — high-level overview, problem statement, goals, and target audience',
    sections: ['problem-and-objectives', 'features-and-requirements', 'target-audience'],
  },
  prd: {
    description: 'Product Requirements Document — detailed requirements, user personas, and success metrics',
    sections: ['executive-summary', 'problem-statement', 'goals-and-objectives', 'user-personas', 'requirements', 'success-metrics'],
  },
  domainModel: {
    description: 'Domain Model — core entities, relationships, state transitions, and invariants',
    sections: ['entity-definitions', 'entity-relationships', 'state-transitions'],
  },
  specs: {
    description: 'Technical Specifications — architecture, data models, API design, security, and deployment',
    sections: ['architecture-overview', 'data-models', 'api-design', 'component-architecture', 'security-considerations', 'deployment-strategy'],
  },
  stories: {
    description: 'User Stories & Tasks — epics, user stories with acceptance criteria, and technical tasks',
    sections: ['epic-overview', 'user-stories', 'technical-tasks', 'acceptance-criteria'],
  },
  artifacts: {
    description: 'Technical Artifacts — API documentation, database schemas, environment config, deployment scripts',
    sections: ['api-documentation', 'database-schema', 'environment-config', 'deployment-scripts'],
  },
  handoff: {
    description: 'Project Handoff — summary, setup guide, implementation guide, and next steps',
    sections: ['project-summary', 'setup-guide', 'implementation-guide', 'next-steps'],
  },
};

export function buildQuestionPrompt(params: {
  title: string;
  description: string;
  phaseId: string;
  range: { min: number; max: number };
  upstreamContext?: string;
  codebaseContext?: string;
}): string {
  const phaseCtx = PHASE_CONTEXT[params.phaseId];
  const phaseDesc = phaseCtx?.description ?? params.phaseId;
  const sectionsList = phaseCtx?.sections?.join(', ') ?? '';

  const upstreamBlock = params.upstreamContext
    ? `Existing Project Decisions & Prior Phase Answers:\n${params.upstreamContext}\n\n`
    : '';

  const codebaseBlock = params.codebaseContext
    ? `Repository & Codebase Context:\n${params.codebaseContext}\n\n`
    : '';

  return (
    `Generate ${params.range.min}-${params.range.max} specific, high-value questions for the "${params.phaseId}" phase.\n\n` +
    `Phase Purpose: ${phaseDesc}\n` +
    (sectionsList ? `Sections this phase will generate: ${sectionsList}\n\n` : '\n') +
    `Project Title: ${params.title}\n` +
    `Project Description: ${params.description}\n\n` +
    upstreamBlock +
    codebaseBlock +
    `Ask questions whose answers will directly inform the content of the sections listed above. ` +
    `Focus on decisions, constraints, and preferences that the user must clarify before generating each section.\n` +
    `CRITICAL: Do NOT ask questions that have already been definitively answered or decided in the existing project decisions or codebase context above.\n\n` +
    `For each question, also provide 3-5 selectable suggestion options that represent common answers.\n\n` +
    `Return JSON only in this shape:\n` +
    `{"questions":[{"text":"...","required":true,"suggestions":["Option A","Option B","Option C"]}]}`
  );
}

export function normalizeQuestions(
  questions: Array<{ text: string; required?: boolean; suggestions?: string[] }>,
  phaseId: string,
  range: { min: number; max: number },
): Array<{ text: string; required?: boolean; suggestions?: string[] }> {
  const filtered = questions.filter((q) => q.text?.trim().length);
  return filtered.slice(0, range.max);
}

export function selectQuestions(
  aiQuestions: Array<{ text: string; required?: boolean; suggestions?: string[] }>,
  baseQuestions: Array<{ text: string; required?: boolean }>,
  range: { min: number; max: number },
): {
  questions: Array<{ text: string; required?: boolean; suggestions?: string[] }>;
  aiGenerated: boolean;
} {
  if (aiQuestions.length >= range.min) {
    return { questions: aiQuestions.slice(0, range.max), aiGenerated: true };
  }
  return { questions: baseQuestions.slice(0, range.max), aiGenerated: false };
}

function parseQuestionsResponse(
  raw: string,
): Array<{ text: string; required?: boolean; suggestions?: string[] }> {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((text) => (typeof text === 'string' ? { text } : text));
    }
    if (parsed && Array.isArray(parsed.questions)) {
      return parsed.questions;
    }
  } catch {
    // Try to recover JSON object from a wrapped response
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        if (parsed && Array.isArray(parsed.questions)) {
          return parsed.questions;
        }
      } catch {
        return [];
      }
    }
  }
  return [];
}

export const generateQuestions = action({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: async (ctx: ActionCtx, args) => {
    const project = await ctx.runQuery(
      internalApi.internal.getProjectInternal,
      {
        projectId: args.projectId,
      },
    );
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    const userId = identity.tokenIdentifier;
    await rateLimiter.limit(ctx, 'generateQuestions', {
      key: userId,
      throws: true,
    });

    const range = PHASE_QUESTION_RANGE[args.phaseId] || { min: 5, max: 8 };
    const baseQuestions =
      PHASE_QUESTIONS[args.phaseId] || PHASE_QUESTIONS['brief'];

    let aiQuestions: Array<{ text: string; required?: boolean }> = [];
    let aiGenerated = false;
    let credentials: ReturnType<typeof resolveCredentials> = null;
    try {
      // Resolve credentials for AI question generation
      const userConfig = await ctx.runAction(
        internalApi.userConfigActions.getUserConfigInternal,
        {},
      );

      let systemCredentialsMap: Record<string, SystemCredential>;
      try {
        systemCredentialsMap = await ctx.runAction(
          internalApi.internalActions.getAllDecryptedSystemCredentials,
          {},
        );
      } catch {
        systemCredentialsMap = {};
      }

      const enabledModelsFromDb = await ctx.runQuery(
        internalApi.llmModels.listEnabledModelsInternal,
      );
      const enabledModels = selectEnabledModels(enabledModelsFromDb || []);

      credentials = resolveCredentials(
        userConfig,
        new Map(Object.entries(systemCredentialsMap || {})),
        enabledModels,
      );

      const model = resolveModelForCredentials(
        credentials,
        enabledModelsFromDb || [],
        enabledModels,
      );

      // Fetch provider API endpoint from models.dev
      let providerApiEndpoint: string | null = null;
      const providerId = credentials?.provider;
      if (providerId) {
        try {
          const providers = await fetchModelDirectory();
          const provider = providers.find((p) => p.id === providerId);
          providerApiEndpoint = provider?.api || null;
        } catch (err) {
          console.warn(
            `[generateQuestions] Failed to fetch provider API endpoint: ${err}`,
          );
        }
      }

      const llmClient = createLlmClient(credentials, providerApiEndpoint);
      if (!llmClient) {
        console.warn('[generateQuestions] No LLM client — credentials missing or invalid. Falling back to base questions.');
      }
      if (llmClient) {
        // Gather upstream answers from dependent phases
        const upstreamPhaseIds = PHASE_DEPENDENCIES[args.phaseId] || [];
        const upstreamAnswersList: string[] = [];

        if (project.constitutionTemplate?.lockedConstraints) {
          const constraints = project.constitutionTemplate.lockedConstraints;
          const constraintParts: string[] = [];
          if (constraints.architecture) constraintParts.push(`Architecture: ${constraints.architecture}`);
          if (constraints.stateManagement) constraintParts.push(`State Management: ${constraints.stateManagement}`);
          if (constraints.apiDesign) constraintParts.push(`API Design: ${constraints.apiDesign}`);
          if (constraints.securityProtocols?.length) {
            constraintParts.push(`Security Protocols: ${constraints.securityProtocols.join(', ')}`);
          }
          if (constraintParts.length > 0) {
            upstreamAnswersList.push(`[Constitution Constraints]\n${constraintParts.join('\n')}`);
          }
        }

        for (const upstreamPhaseId of upstreamPhaseIds) {
          const upstreamPhase = await ctx.runQuery(
            internalApi.internal.getPhaseInternal,
            { projectId: args.projectId, phaseId: upstreamPhaseId },
          );
          if (upstreamPhase?.questions) {
            const answered = upstreamPhase.questions
              .filter((q: { answer?: string }) => q.answer?.trim())
              .map((q: { text: string; answer?: string }) => `Q: [${upstreamPhaseId}] ${q.text}\nA: ${q.answer}`);
            if (answered.length > 0) {
              upstreamAnswersList.push(answered.join('\n\n'));
            }
          }
        }
        const upstreamContext = upstreamAnswersList.join('\n\n');

        let codebaseContext: string | undefined;
        try {
          const codebase = await ctx.runQuery(
            internalApi.internal.getCodebaseInternal,
            { projectId: args.projectId },
          );
          if (codebase) {
            const keyFilePaths = (codebase.keyFiles || []).map((f: { path: string }) => f.path).slice(0, 10);
            codebaseContext = `Repository: ${codebase.repoOwner}/${codebase.repoName} (${codebase.defaultBranch})\nKey Files: ${keyFilePaths.join(', ')}`;
          }
        } catch {
          // Codebase lookup is optional
        }

        const isEarlyPhase = args.phaseId === 'constitution' || args.phaseId === 'brief';
        const projectDescription = isEarlyPhase
          ? project.description
          : (project.description.length > 3000
              ? `${project.description.slice(0, 3000)}\n\n[... Project description truncated for downstream phase. Refer to approved upstream Constitution and Brief ...]`
              : project.description);

        const prompt = buildQuestionPrompt({
          title: project.title,
          description: projectDescription,
          phaseId: args.phaseId,
          range,
          upstreamContext: upstreamContext || undefined,
          codebaseContext,
        });

        const telemetryProvider = credentials?.provider ?? model.provider;
        const telemetryModel = model.id;
        const startedAt = Date.now();
        const response = await retryWithBackoff(
          () =>
            llmClient.complete(prompt, {
              model: model.id,
              maxTokens: LLM_DEFAULTS.QUESTION_ANSWER_TOKENS,
              temperature: 0.4,
            }),
          { retries: 3, minDelayMs: 500, maxDelayMs: 4000 },
        );
        const durationMs = Date.now() - startedAt;
        logTelemetry('info', {
          provider: telemetryProvider,
          model: telemetryModel,
          durationMs,
          success: true,
          tokens: {
            prompt: response.usage.promptTokens,
            completion: response.usage.completionTokens,
            total: response.usage.totalTokens,
          },
        });
        aiQuestions = normalizeQuestions(
          parseQuestionsResponse(response.content),
          args.phaseId,
          range,
        );
      }
    } catch (err) {
      console.error('[generateQuestions] AI question generation failed:', err);
      logTelemetry('warn', {
        provider: credentials?.provider ?? 'unknown',
        model: 'unknown',
        success: false,
        error: `generateQuestions failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      aiQuestions = [];
    }

    const selection = selectQuestions(aiQuestions, baseQuestions, range);
    aiGenerated = selection.aiGenerated;

    const questions = selection.questions.map((q, idx) => ({
      id: `${args.phaseId}-q${idx + 1}`,
      text: q.text,
      answer: undefined as string | undefined,
      aiGenerated,
      required: q.required ?? false,
      suggestions: Array.isArray(q.suggestions) ? q.suggestions.filter((s): s is string => typeof s === 'string') : undefined,
    }));

    await ctx.runMutation(internalApi.internal.updatePhaseQuestionsInternal, {
      projectId: args.projectId,
      phaseId: args.phaseId,
      questions,
    });

    return { questions };
  },
});

export interface GrillQuestionItem {
  text: string;
  recommendedAnswer?: string;
  suggestions?: string[];
}

export const GRILL_FALLBACK_QUESTIONS: Record<string, GrillQuestionItem[]> = {
  constitution: [
    {
      text: 'What strict linting and test coverage thresholds will block pull request CI merge gates?',
      recommendedAnswer:
        'Enforce strict TypeScript with zero compiler warnings and 80%+ branch coverage on all domain logic.',
      suggestions: [
        'Enforce strict TypeScript with zero warnings and 80%+ branch coverage',
        'Standard linting with 70% coverage requirement',
        'Advisory checks only without blocking merges',
      ],
    },
    {
      text: 'What is the non-negotiable policy on database schema migrations and backward compatibility?',
      recommendedAnswer:
        'Mandate expand-and-contract zero-downtime migrations with backward-compatible schema changes.',
      suggestions: [
        'Expand-and-contract zero-downtime migrations',
        'Maintenance window with offline migrations',
        'Direct automated migrations without rollbacks',
      ],
    },
  ],
  brief: [
    {
      text: 'What primary user failure state or onboarding drop-off risk must this solution prevent?',
      recommendedAnswer:
        'Provide a zero-friction guided wizard with instant optimistic feedback and sensible default templates.',
      suggestions: [
        'Guided wizard with instant optimistic feedback and sensible defaults',
        'Comprehensive documentation and tooltip tour',
        'Interactive sandbox mode for first-time users',
      ],
    },
    {
      text: 'What external integration failure would immediately jeopardize the primary project objective?',
      recommendedAnswer:
        'Design resilient fallback queues and offline caching so core workflows remain available during provider outages.',
      suggestions: [
        'Resilient fallback queues and offline caching',
        'Immediate user notification with graceful error state',
        'Multi-provider active-active failover',
      ],
    },
  ],
  prd: [
    {
      text: 'What explicit trade-off is accepted between feature delivery velocity and system performance?',
      recommendedAnswer:
        'Deliver vertical tracer bullet features with bounded latency budgets (<200ms p95) rather than unconstrained horizontal mocks.',
      suggestions: [
        'Vertical tracer bullets with strict p95 < 200ms latency budgets',
        'Velocity first with performance tuning in hardening sprints',
        'Horizontal layers with synthetic benchmarks',
      ],
    },
    {
      text: 'How will user permission boundaries and tenant data isolation be verified across edge cases?',
      recommendedAnswer:
        'Row-level access controls enforced in database queries paired with automated cross-tenant security test suites.',
      suggestions: [
        'Row-level security in database queries with cross-tenant tests',
        'Application-level middleware filtering with RBAC matrix',
        'Physical database-per-tenant isolation',
      ],
    },
  ],
  domainModel: [
    {
      text: 'What domain invariant must never be violated across concurrent multi-entity mutations?',
      recommendedAnswer:
        'Enforce transactional consistency boundaries within domain aggregates before emitting domain events.',
      suggestions: [
        'Transactional consistency boundaries within domain aggregates',
        'Eventual consistency with compensating saga transactions',
        'Database-level triggers and foreign key constraints',
      ],
    },
    {
      text: 'What is the canonical ubiquitous language term for this primary resource to prevent team synonym drift?',
      recommendedAnswer:
        'Establish an unambiguous noun in CONTEXT.md with explicit forbidden conflicting synonyms across code and UI.',
      suggestions: [
        'Unambiguous noun in CONTEXT.md with forbidden synonyms',
        'Flexible synonyms allowed across different submodules',
        'Standard database table naming conventions only',
      ],
    },
  ],
  specs: [
    {
      text: 'Where are the explicit architectural seams (Feathers) located to isolate side effects during automated testing?',
      recommendedAnswer:
        'Abstract all external I/O behind narrow interfaces injected at composition roots to enable pure in-memory test doubles.',
      suggestions: [
        'Abstract I/O behind narrow interfaces injected at composition roots',
        'Integration tests against real containerized test dependencies',
        'Monolithic end-to-end tests through the web UI',
      ],
    },
    {
      text: 'How are deep module interfaces (Ousterhout) structured to hide internal complexity and isolate downstream consumers from change?',
      recommendedAnswer:
        'Expose minimal declarative methods that handle orchestration internally and encapsulate error states.',
      suggestions: [
        'Minimal declarative methods that handle orchestration internally',
        'Fine-grained shallow methods leaving orchestration to callers',
        'Shared utility functions across multiple modules',
      ],
    },
  ],
  stories: [
    {
      text: 'Which user story serves as the initial end-to-end vertical tracer bullet across the entire stack?',
      recommendedAnswer:
        'Slice the primary happy-path flow through database, API, UI, and automated test seam as Ticket #1.',
      suggestions: [
        'Primary happy path through DB, API, UI, and test seam as Ticket #1',
        'Complete database schema and migrations first',
        'Complete UI mockup and design system components first',
      ],
    },
    {
      text: 'What explicit blocking dependencies prevent parallel execution among the implementation tickets?',
      recommendedAnswer:
        'Topologically sort tickets so foundation contracts block feature slices, maintaining a visible execution frontier.',
      suggestions: [
        'Topological DAG where foundation contracts block feature slices',
        'Sprint-based milestone grouping without strict blockers',
        'Developer self-assignment without dependency graphs',
      ],
    },
  ],
  artifacts: [
    {
      text: 'What automated contract testing ensures generated artifacts stay synchronized with runtime schemas?',
      recommendedAnswer:
        'Validate OpenAPI and schema exports against live contract test fixtures in the CI pipeline.',
      suggestions: [
        'Automated contract tests against OpenAPI/schema exports in CI',
        'Manual periodic documentation reviews',
        'Code generation scripts triggered on git pre-commit hooks',
      ],
    },
  ],
  handoff: [
    {
      text: 'What local environment setup step historically causes the most developer onboarding friction?',
      recommendedAnswer:
        'Provide a single-command setup script with verified pre-flight dependency checks and seeded mock data.',
      suggestions: [
        'Single-command setup script with verified pre-flight checks and seeded mock data',
        'Comprehensive step-by-step markdown setup guide',
        'Containerized DevContainer or Docker Compose environment',
      ],
    },
  ],
};

export function buildGrillRoundPrompt(params: {
  title: string;
  description: string;
  phaseId: string;
  count: number;
  upstreamAnswers?: string;
  priorGrillHistory?: Array<{ question: string; answer: string }>;
}): string {
  const phaseCtx = PHASE_CONTEXT[params.phaseId];
  const phaseDesc = phaseCtx?.description ?? params.phaseId;
  const sectionsList = phaseCtx?.sections?.join(', ') ?? '';

  const priorHistoryText =
    params.priorGrillHistory && params.priorGrillHistory.length > 0
      ? `Prior Grilling Questions & User Answers in this session:\n` +
        params.priorGrillHistory
          .map((h, i) => `${i + 1}. Q: ${h.question}\n   A: ${h.answer}`)
          .join('\n') +
        '\n\n'
      : '';

  const upstreamText = params.upstreamAnswers
    ? `Existing Phase Answers & Decisions:\n${params.upstreamAnswers}\n\n`
    : '';

  return (
    `You are an elite Principal Software Architect performing an interactive "Stress-Test Plan" grilling session.\n\n` +
    `Project: ${params.title}\n` +
    `Description: ${params.description}\n` +
    `Target Phase: ${params.phaseId} (${phaseDesc})\n` +
    (sectionsList ? `Sections in this phase: ${sectionsList}\n\n` : '\n') +
    upstreamText +
    priorHistoryText +
    `GOAL:\n` +
    `Ask exactly ${params.count} challenging, architectural questions that pressure-test assumptions, failure modes, data invariants, and ambiguous boundaries for this phase.\n` +
    `Do NOT ask generic or repetitive questions. Build on prior answers if any exist.\n\n` +
    `CRITICAL REQUIREMENT:\n` +
    `For EVERY question, you MUST provide a concrete, opinionated "recommendedAnswer" adhering to 2026 production-grade standards (e.g., deep interfaces, explicit test seams, idempotent mutations, tracer bullets, exponential backoff, ubiquitous language) so the user can accept it with one click.\n` +
    `Also provide 2-3 selectable alternative suggestions.\n\n` +
    `Return JSON ONLY in this format:\n` +
    `{"questions": [{"text": "...", "recommendedAnswer": "...", "suggestions": ["Option A", "Option B", "Option C"]}]}`
  );
}

export function parseGrillQuestionsResponse(raw: string): GrillQuestionItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item === 'object' && typeof item.text === 'string')
        .map((item) => ({
          text: item.text,
          recommendedAnswer: typeof item.recommendedAnswer === 'string' ? item.recommendedAnswer : undefined,
          suggestions: Array.isArray(item.suggestions)
            ? item.suggestions.filter((s: unknown): s is string => typeof s === 'string')
            : undefined,
        }));
    }
    if (parsed && Array.isArray(parsed.questions)) {
      return parsed.questions
        .filter((item: unknown) => item && typeof item === 'object' && typeof (item as { text: unknown }).text === 'string')
        .map((item: { text: string; recommendedAnswer?: unknown; suggestions?: unknown }) => ({
          text: item.text,
          recommendedAnswer: typeof item.recommendedAnswer === 'string' ? item.recommendedAnswer : undefined,
          suggestions: Array.isArray(item.suggestions)
            ? item.suggestions.filter((s: unknown): s is string => typeof s === 'string')
            : undefined,
        }));
    }
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        if (parsed && Array.isArray(parsed.questions)) {
          return parsed.questions
            .filter((item: unknown) => item && typeof item === 'object' && typeof (item as { text: unknown }).text === 'string')
            .map((item: { text: string; recommendedAnswer?: unknown; suggestions?: unknown }) => ({
              text: item.text,
              recommendedAnswer: typeof item.recommendedAnswer === 'string' ? item.recommendedAnswer : undefined,
              suggestions: Array.isArray(item.suggestions)
                ? item.suggestions.filter((s: unknown): s is string => typeof s === 'string')
                : undefined,
            }));
        }
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function normalizeGrillQuestions(
  questions: GrillQuestionItem[],
  fallback: GrillQuestionItem[],
  count: number,
): GrillQuestionItem[] {
  const valid = questions.filter((q) => q.text?.trim().length > 0);
  if (valid.length >= count) {
    return valid.slice(0, count);
  }
  const merged = [...valid];
  for (const item of fallback) {
    if (merged.length >= count) break;
    if (!merged.some((m) => m.text.toLowerCase() === item.text.toLowerCase())) {
      merged.push(item);
    }
  }
  return merged.slice(0, count);
}

export interface GeneratedGrillQuestion {
  id: string;
  text: string;
  answer?: string;
  recommendedAnswer?: string;
  suggestions?: string[];
  grillRound: number;
  aiGenerated: boolean;
  required: boolean;
}

export interface GenerateGrillRoundResult {
  questions: GeneratedGrillQuestion[];
  currentRound: number;
  totalQuestionsAsked: number;
  reachedLimit: boolean;
}

export const generateGrillRound = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args,
  ): Promise<GenerateGrillRoundResult> => {
    const project = await ctx.runQuery(
      internalApi.internal.getProjectInternal,
      {
        projectId: args.projectId,
      },
    );
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    const userId = identity.tokenIdentifier;
    await rateLimiter.limit(ctx, 'generateQuestions', {
      key: userId,
      throws: true,
    });

    const phase = (await ctx.runQuery(
      internalApi.internal.getPhaseInternal,
      {
        projectId: args.projectId,
        phaseId: args.phaseId,
      },
    )) as (Doc<'phases'> & { artifacts?: unknown[] }) | null;

    const grillSession = phase?.grillSession;
    const currentCount = grillSession?.totalQuestionsAsked ?? 0;
    const currentRound = (grillSession?.currentRound ?? 0) + 1;
    const remaining = 10 - currentCount;

    if (remaining <= 0) {
      return {
        questions: [],
        currentRound: grillSession?.currentRound ?? 1,
        totalQuestionsAsked: currentCount,
        reachedLimit: true,
      };
    }

    const countToAsk = Math.min(remaining, 3);
    const fallbackList =
      GRILL_FALLBACK_QUESTIONS[args.phaseId] ||
      GRILL_FALLBACK_QUESTIONS['specs'] ||
      [];

    let rawAiQuestions: GrillQuestionItem[] = [];
    let credentials: ReturnType<typeof resolveCredentials> = null;

    try {
      const userConfig = await ctx.runAction(
        internalApi.userConfigActions.getUserConfigInternal,
        {},
      );

      let systemCredentialsMap: Record<string, SystemCredential>;
      try {
        systemCredentialsMap = await ctx.runAction(
          internalApi.internalActions.getAllDecryptedSystemCredentials,
          {},
        );
      } catch {
        systemCredentialsMap = {};
      }

      const enabledModelsFromDb = await ctx.runQuery(
        internalApi.llmModels.listEnabledModelsInternal,
      );
      const enabledModels = selectEnabledModels(enabledModelsFromDb || []);

      credentials = resolveCredentials(
        userConfig,
        new Map(Object.entries(systemCredentialsMap || {})),
        enabledModels,
      );

      const model = resolveModelForCredentials(
        credentials,
        enabledModelsFromDb || [],
        enabledModels,
      );

      let providerApiEndpoint: string | null = null;
      const providerId = credentials?.provider;
      if (providerId) {
        try {
          const providers = await fetchModelDirectory();
          const provider = providers.find((p) => p.id === providerId);
          providerApiEndpoint = provider?.api || null;
        } catch (err) {
          console.warn(
            `[generateGrillRound] Failed to fetch provider API endpoint: ${err}`,
          );
        }
      }

      const llmClient = createLlmClient(credentials, providerApiEndpoint);
      if (llmClient) {
        const upstreamPhaseIds = PHASE_DEPENDENCIES[args.phaseId] || [];
        const upstreamAnswersList: string[] = [];

        if (project.constitutionTemplate?.lockedConstraints) {
          const constraints = project.constitutionTemplate.lockedConstraints;
          const constraintParts: string[] = [];
          if (constraints.architecture) constraintParts.push(`Architecture: ${constraints.architecture}`);
          if (constraints.stateManagement) constraintParts.push(`State Management: ${constraints.stateManagement}`);
          if (constraints.apiDesign) constraintParts.push(`API Design: ${constraints.apiDesign}`);
          if (constraints.securityProtocols?.length) {
            constraintParts.push(`Security Protocols: ${constraints.securityProtocols.join(', ')}`);
          }
          if (constraintParts.length > 0) {
            upstreamAnswersList.push(`[Constitution Constraints]\n${constraintParts.join('\n')}`);
          }
        }

        for (const upstreamPhaseId of upstreamPhaseIds) {
          const upstreamPhase = await ctx.runQuery(
            internalApi.internal.getPhaseInternal,
            { projectId: args.projectId, phaseId: upstreamPhaseId },
          );
          if (upstreamPhase?.questions) {
            const answered = upstreamPhase.questions
              .filter((q: { answer?: string }) => q.answer?.trim())
              .map((q: { text: string; answer?: string }) => `Q: [${upstreamPhaseId}] ${q.text}\nA: ${q.answer}`);
            if (answered.length > 0) {
              upstreamAnswersList.push(answered.join('\n\n'));
            }
          }
        }

        const currentPhaseAnswers = (phase?.questions || [])
          .filter((q: { answer?: string }) => q.answer?.trim())
          .map((q: { text: string; answer?: string }) => `Q: ${q.text}\nA: ${q.answer}`);
        if (currentPhaseAnswers.length > 0) {
          upstreamAnswersList.push(currentPhaseAnswers.join('\n\n'));
        }

        const upstreamAnswers = upstreamAnswersList.join('\n\n');

        const priorGrillHistory = grillSession?.rounds
          ? grillSession.rounds
              .flatMap((r) => r.questions)
              .map((q) => ({
                question: q.text,
                answer: q.userAnswer || q.recommendedAnswer,
              }))
          : [];

        const isEarlyPhase = args.phaseId === 'constitution' || args.phaseId === 'brief';
        const projectDescription = isEarlyPhase
          ? project.description
          : (project.description.length > 3000
              ? `${project.description.slice(0, 3000)}\n\n[... Project description truncated for downstream phase. Refer to approved upstream Constitution and Brief ...]`
              : project.description);

        const prompt = buildGrillRoundPrompt({
          title: project.title,
          description: projectDescription,
          phaseId: args.phaseId,
          count: countToAsk,
          upstreamAnswers: upstreamAnswers || undefined,
          priorGrillHistory,
        });

        const startedAt = Date.now();
        const response = await retryWithBackoff(
          () =>
            llmClient.complete(prompt, {
              model: model.id,
              maxTokens: LLM_DEFAULTS.QUESTION_ANSWER_TOKENS,
              temperature: 0.3,
            }),
          { retries: 2, minDelayMs: 500, maxDelayMs: 3000 },
        );
        const durationMs = Date.now() - startedAt;

        logTelemetry('info', {
          provider: credentials?.provider ?? model.provider,
          model: model.id,
          durationMs,
          success: true,
          tokens: {
            prompt: response.usage.promptTokens,
            completion: response.usage.completionTokens,
            total: response.usage.totalTokens,
          },
        });

        rawAiQuestions = parseGrillQuestionsResponse(response.content);
      }
    } catch (err) {
      console.error('[generateGrillRound] AI grilling round generation failed:', err);
      logTelemetry('warn', {
        provider: credentials?.provider ?? 'unknown',
        model: 'unknown',
        success: false,
        error: `generateGrillRound failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      rawAiQuestions = [];
    }

    const normalized = normalizeGrillQuestions(
      rawAiQuestions,
      fallbackList,
      countToAsk,
    );

    const questions = normalized.map((q, idx) => ({
      id: `${args.phaseId}-grill-r${currentRound}-q${idx + 1}`,
      text: q.text,
      answer: undefined as string | undefined,
      recommendedAnswer: q.recommendedAnswer,
      suggestions: q.suggestions,
      grillRound: currentRound,
      aiGenerated: true,
      required: false,
    }));

    return {
      questions,
      currentRound,
      totalQuestionsAsked: currentCount,
      reachedLimit: currentCount + questions.length >= 10,
    };
  },
});
