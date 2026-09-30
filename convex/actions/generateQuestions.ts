'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { replyTokensFor } from '../../lib/llm/reply-tokens';
import { retryWithBackoff } from '../../lib/llm/retry';
import { openLlmSession } from './llmSession';
import { loadQuestionContext } from '../lib/question_context';
import { rateLimiter } from '../rateLimiter';
import { logTelemetry } from '../../lib/llm/telemetry';
import { PHASE_PURPOSE, sectionIdsFor, sectionsFor } from '../../lib/specification/phase-sections';
import type { PhaseId } from '../../lib/workflow';
import {
  isGrillQuestion,
  newQuestionId,
  sanitizeFeeds,
  type PhaseQuestion,
} from '../../lib/specification/question-model';

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

export function buildQuestionPrompt(params: {
  title: string;
  description: string;
  phaseId: string;
  range: { min: number; max: number };
  upstreamContext?: string;
  codebaseContext?: string;
  /** Questions already asked and answered, which the new ones must not repeat. */
  alreadyAsked?: string[];
}): string {
  const phaseDesc = PHASE_PURPOSE[params.phaseId as PhaseId] ?? params.phaseId;
  const sections = sectionsFor(params.phaseId);
  const sectionsBlock = sections.length
    ? `Sections this phase will generate. Every question must inform at least one of them:\n` +
      sections.map((section) => `- ${section.id}: ${section.description}`).join('\n') +
      '\n\n'
    : '';

  const upstreamBlock = params.upstreamContext
    ? `Existing Project Decisions & Prior Phase Answers:\n${params.upstreamContext}\n\n`
    : '';

  const codebaseBlock = params.codebaseContext
    ? `Repository & Codebase Context:\n${params.codebaseContext}\n\n`
    : '';

  const askedBlock = params.alreadyAsked?.length
    ? `Questions already asked and answered for this phase. Do not repeat or rephrase them:\n${params.alreadyAsked.map((text) => `- ${text}`).join('\n')}\n\n`
    : '';

  return (
    `Generate ${params.range.min}-${params.range.max} specific, high-value questions for the "${params.phaseId}" phase.\n\n` +
    `Phase Purpose: ${phaseDesc}\n\n` +
    sectionsBlock +
    `Project Title: ${params.title}\n` +
    `Project Description: ${params.description}\n\n` +
    upstreamBlock +
    codebaseBlock +
    askedBlock +
    `Ask questions whose answers will directly inform the content of the sections listed above. ` +
    `Focus on decisions, constraints, and preferences that the user must clarify before generating each section.\n` +
    `CRITICAL: Do NOT ask questions that have already been definitively answered or decided in the existing project decisions or codebase context above.\n\n` +
    `For each question, name the sections it informs in "feeds", using section ids exactly as written above. ` +
    `Also provide 3-5 selectable suggestion options that represent common answers.\n\n` +
    `Return JSON only in this shape:\n` +
    `{"questions":[{"text":"...","required":true,"feeds":["section-id"],"suggestions":["Option A","Option B","Option C"]}]}`
  );
}

export interface CandidateQuestion {
  text: string;
  required?: boolean;
  suggestions?: string[];
  feeds?: string[];
}

export function normalizeQuestions(
  questions: CandidateQuestion[],
  phaseId: string,
  range: { min: number; max: number },
): CandidateQuestion[] {
  return questions
    .filter((q) => q.text?.trim().length)
    .slice(0, range.max)
    .map((q) => ({ ...q, feeds: sanitizeFeeds(q.feeds, phaseId) }));
}

function normalizedText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * The phase's questions after a regenerate: every answered question stays as it is, and the model's
 * questions replace only the unanswered ones.
 *
 * The generic fallback questions fill a shortfall below the phase minimum and never displace a
 * question the model wrote. A question already present, answered or not, is not added twice.
 */
export function mergeRegeneratedQuestions(
  existing: PhaseQuestion[],
  fromModel: CandidateQuestion[],
  fallback: Array<{ text: string; required?: boolean }>,
  range: { min: number; max: number },
): PhaseQuestion[] {
  const kept = existing.filter((q) => q.answer?.trim());
  const keptPhaseCount = kept.filter((q) => !isGrillQuestion(q)).length;
  const taken = new Set(kept.map((q) => normalizedText(q.text)));
  const room = () => Math.max(0, range.max - keptPhaseCount - added.length);
  const added: PhaseQuestion[] = [];

  for (const candidate of fromModel) {
    if (room() === 0) break;
    if (taken.has(normalizedText(candidate.text))) continue;
    taken.add(normalizedText(candidate.text));
    added.push({
      id: newQuestionId(),
      text: candidate.text,
      required: candidate.required ?? false,
      suggestions: Array.isArray(candidate.suggestions)
        ? candidate.suggestions.filter((s): s is string => typeof s === 'string')
        : undefined,
      source: 'phase',
      feeds: candidate.feeds ?? [],
    });
  }

  for (const base of fallback) {
    if (keptPhaseCount + added.length >= range.min || room() === 0) break;
    if (taken.has(normalizedText(base.text))) continue;
    taken.add(normalizedText(base.text));
    added.push({
      id: newQuestionId(),
      text: base.text,
      required: base.required ?? false,
      source: 'phase',
      feeds: [],
    });
  }

  return [...kept, ...added];
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

export async function generateQuestionsHandler(
  ctx: ActionCtx,
  args: { projectId: Id<'projects'>; phaseId: string },
) {
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

  const existingPhase = await ctx.runQuery(
    internalApi.internal.getPhaseInternal,
    { projectId: args.projectId, phaseId: args.phaseId },
  );
  const existingQuestions: PhaseQuestion[] = existingPhase?.questions ?? [];
  const answeredTexts = existingQuestions
    .filter((q) => q.answer?.trim())
    .map((q) => q.text);

  let aiQuestions: CandidateQuestion[] = [];
  let provider = 'unknown';
  try {
    const session = await openLlmSession(ctx);
    provider = session.model.provider;
    const context = await loadQuestionContext(ctx, project, args.phaseId);

    const prompt = buildQuestionPrompt({
      title: project.title,
      description: context.description,
      phaseId: args.phaseId,
      range,
      upstreamContext: context.upstream || undefined,
      codebaseContext: context.codebase,
      alreadyAsked: answeredTexts,
    });

    const startedAt = Date.now();
    const response = await retryWithBackoff(
      () =>
        session.client.complete(prompt, {
          model: session.modelId,
          maxTokens: replyTokensFor(session.model),
          temperature: 0.4,
        }),
      { retries: 3, minDelayMs: 500, maxDelayMs: 4000 },
    );
    logTelemetry('info', {
      provider,
      model: session.modelId,
      durationMs: Date.now() - startedAt,
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
  } catch (err) {
    console.error('[generateQuestions] AI question generation failed:', err);
    logTelemetry('warn', {
      provider,
      model: 'unknown',
      success: false,
      error: `generateQuestions failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    aiQuestions = [];
  }

  const questions = mergeRegeneratedQuestions(
    existingQuestions,
    aiQuestions,
    baseQuestions,
    range,
  );

  await ctx.runMutation(internalApi.internal.updatePhaseQuestionsInternal, {
    projectId: args.projectId,
    phaseId: args.phaseId,
    questions,
  });

  return { questions };
}

export const generateQuestions = action({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: generateQuestionsHandler,
});

export interface GrillQuestionItem {
  text: string;
  recommendedAnswer?: string;
  suggestions?: string[];
  feeds?: string[];
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
  const phaseDesc = PHASE_PURPOSE[params.phaseId as PhaseId] ?? params.phaseId;
  const sectionsList = sectionIdsFor(params.phaseId).join(', ');

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
    `RECOMMENDATIONS:\n` +
    `Give every question a concrete "recommendedAnswer" the user could accept with one click. Base it on this project's own rules, requirements and earlier answers above, and on what its description says it needs. ` +
    `Do not import a fixed house style. If nothing in the project supports a recommendation, omit "recommendedAnswer" and give 2-4 distinct options in "suggestions" so the user chooses.\n` +
    `Also provide 2-3 selectable alternative suggestions when you recommend an answer.\n` +
    (sectionsList
      ? `Name the sections each question informs in "feeds", using these ids exactly as written: ${sectionsList}.\n`
      : '') +
    `\nReturn JSON ONLY in this format:\n` +
    `{"questions": [{"text": "...", "recommendedAnswer": "...", "feeds": ["section-id"], "suggestions": ["Option A", "Option B", "Option C"]}]}`
  );
}

function extractGrillText(item: Record<string, unknown>): string | undefined {
  if (typeof item.text === 'string' && item.text.trim()) return item.text.trim();
  if (typeof item.question === 'string' && item.question.trim()) return item.question.trim();
  if (typeof item.prompt === 'string' && item.prompt.trim()) return item.prompt.trim();
  return undefined;
}

function extractGrillRecommendation(item: Record<string, unknown>): string | undefined {
  const candidate =
    item.recommendedAnswer ??
    item.recommended_answer ??
    item.recommendation ??
    item.recommended ??
    item.suggestedAnswer ??
    item.suggested_answer ??
    item.suggested ??
    item.best_practice ??
    item.answer;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  return undefined;
}

function extractGrillSuggestions(item: Record<string, unknown>): string[] | undefined {
  const candidate =
    item.suggestions ??
    item.options ??
    item.choices ??
    item.alternatives;
  if (Array.isArray(candidate)) {
    const list = candidate.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    return list.length > 0 ? list : undefined;
  }
  return undefined;
}

function mapToGrillItem(rawItem: unknown): GrillQuestionItem | null {
  if (!rawItem || typeof rawItem !== 'object') return null;
  const obj = rawItem as Record<string, unknown>;
  const text = extractGrillText(obj);
  if (!text) return null;
  const recommendedAnswer = extractGrillRecommendation(obj);
  const suggestions = extractGrillSuggestions(obj);
  const feeds = Array.isArray(obj.feeds)
    ? obj.feeds.filter((feed): feed is string => typeof feed === 'string')
    : undefined;
  return {
    text,
    recommendedAnswer,
    suggestions,
    feeds,
  };
}

export function parseGrillQuestionsResponse(raw: string): GrillQuestionItem[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const items = parsed.map(mapToGrillItem).filter((item): item is GrillQuestionItem => item !== null);
      if (items.length > 0) return items;
    }
    if (parsed && typeof parsed === 'object') {
      const arrayCandidate = (parsed as Record<string, unknown>).questions || (parsed as Record<string, unknown>).items || (parsed as Record<string, unknown>).data;
      if (Array.isArray(arrayCandidate)) {
        const items = arrayCandidate.map(mapToGrillItem).filter((item): item is GrillQuestionItem => item !== null);
        if (items.length > 0) return items;
      }
    }
  } catch {
    // Continue to substring extraction
  }

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let start = -1;
  let end = -1;

  if (firstBracket >= 0 && (firstBrace === -1 || firstBracket < firstBrace)) {
    start = firstBracket;
    end = cleaned.lastIndexOf(']');
  } else if (firstBrace >= 0) {
    start = firstBrace;
    end = cleaned.lastIndexOf('}');
  }

  if (start >= 0 && end > start) {
    try {
      const substring = cleaned.slice(start, end + 1);
      const parsed = JSON.parse(substring);
      if (Array.isArray(parsed)) {
        const items = parsed.map(mapToGrillItem).filter((item): item is GrillQuestionItem => item !== null);
        if (items.length > 0) return items;
      }
      if (parsed && typeof parsed === 'object') {
        const arrayCandidate = (parsed as Record<string, unknown>).questions || (parsed as Record<string, unknown>).items || (parsed as Record<string, unknown>).data;
        if (Array.isArray(arrayCandidate)) {
          const items = arrayCandidate.map(mapToGrillItem).filter((item): item is GrillQuestionItem => item !== null);
          if (items.length > 0) return items;
        }
      }
    } catch {
      // Substring extraction failed
    }
  }

  return [];
}

/**
 * The questions to ask this round: the model's, then fallback questions to reach `count`.
 *
 * A question keeps exactly the recommendation the model gave it. None is invented from an option or
 * borrowed from another question, because a recommendation the user can accept with one click has to
 * be one the project supports.
 */
export function normalizeGrillQuestions(
  questions: GrillQuestionItem[],
  fallback: GrillQuestionItem[],
  count: number,
  phaseId: string,
): GrillQuestionItem[] {
  const valid = questions.filter((q) => q.text?.trim().length > 0);
  const merged = [...valid];
  for (const item of fallback) {
    if (merged.length >= count) break;
    if (!merged.some((m) => m.text.toLowerCase() === item.text.toLowerCase())) {
      merged.push(item);
    }
  }

  return merged.slice(0, count).map((item) => ({
    text: item.text.trim(),
    recommendedAnswer: item.recommendedAnswer?.trim() || undefined,
    suggestions: item.suggestions?.length ? item.suggestions : undefined,
    feeds: sanitizeFeeds(item.feeds, phaseId),
  }));
}

export interface GeneratedGrillQuestion {
  id: string;
  text: string;
  answer?: string;
  recommendedAnswer?: string;
  suggestions?: string[];
  feeds: string[];
  grillRound: number;
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
    const fallbackList = GRILL_FALLBACK_QUESTIONS[args.phaseId] ?? [];

    let rawAiQuestions: GrillQuestionItem[] = [];
    let provider = 'unknown';

    try {
      const session = await openLlmSession(ctx);
      provider = session.model.provider;
      const context = await loadQuestionContext(ctx, project, args.phaseId);

      const currentPhaseAnswers = (phase?.questions || [])
        .filter((q: { answer?: string }) => q.answer?.trim())
        .map((q: { text: string; answer?: string }) => `Q: ${q.text}\nA: ${q.answer}`)
        .join('\n\n');
      const upstreamAnswers = [context.upstream, currentPhaseAnswers]
        .filter((block) => block.length > 0)
        .join('\n\n');

      const priorGrillHistory = grillSession?.rounds
        ? grillSession.rounds
            .flatMap((r) => r.questions)
            .map((q) => ({
              question: q.text,
              answer: q.userAnswer || q.recommendedAnswer || '',
            }))
            .filter((entry) => entry.answer.length > 0)
        : [];

      const prompt = buildGrillRoundPrompt({
        title: project.title,
        description: context.description,
        phaseId: args.phaseId,
        count: countToAsk,
        upstreamAnswers: upstreamAnswers || undefined,
        priorGrillHistory,
      });

      const startedAt = Date.now();
      const response = await retryWithBackoff(
        () =>
          session.client.complete(prompt, {
            model: session.modelId,
            maxTokens: replyTokensFor(session.model),
            temperature: 0.3,
          }),
        { retries: 2, minDelayMs: 500, maxDelayMs: 3000 },
      );

      logTelemetry('info', {
        provider,
        model: session.modelId,
        durationMs: Date.now() - startedAt,
        success: true,
        tokens: {
          prompt: response.usage.promptTokens,
          completion: response.usage.completionTokens,
          total: response.usage.totalTokens,
        },
      });

      rawAiQuestions = parseGrillQuestionsResponse(response.content);
    } catch (err) {
      console.error('[generateGrillRound] AI grilling round generation failed:', err);
      logTelemetry('warn', {
        provider,
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
      args.phaseId,
    );

    const questions = normalized.map((q, idx) => ({
      id: newQuestionId(),
      text: q.text,
      answer: undefined as string | undefined,
      recommendedAnswer: q.recommendedAnswer,
      suggestions: q.suggestions,
      feeds: q.feeds ?? [],
      grillRound: currentRound,
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
