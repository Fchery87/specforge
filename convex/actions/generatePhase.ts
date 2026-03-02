'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import type { Id, Doc } from '../_generated/dataModel';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  FALLBACK_MODELS,
  expandSectionsForBudget,
  getSectionPlan,
  planSections,
  mergeSectionContent,
  estimateTokenCount,
} from '../../lib/llm/chunking';
import {
  getModelById,
  getFallbackModel,
  validateModelForArtifact,
  resolveCredentials,
  validateProviderModelMatch,
  getFirstEnabledModelForProvider,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import type {
  SectionPlan,
  ProviderCredentials,
  LlmModel,
} from '../../lib/llm/types';
import { getArtifactTypeForPhase } from '../../lib/llm/artifact-types';
import { fetchModelDirectory } from '../../lib/llm/model-directory';
import type { SystemCredential } from '../../lib/llm/registry';
import { createLlmClient } from '../../lib/llm/client-factory';
import { retryWithBackoff } from '../../lib/llm/retry';
import { continueIfTruncated } from '../../lib/llm/continuation';
import { rateLimiter } from '../rateLimiter';
import { renderPreviewHtml } from '../../lib/markdown-render';
import { logTelemetry } from '../../lib/llm/telemetry';
import {
  CONSTITUTION_PROMPT,
  injectConstitutionContext,
} from '../../lib/llm/prompts/constitution';
import {
  CRITIC_PROMPT,
  buildCriticPrompt,
  parseCritiqueResult,
  shouldCritiquePhase,
  type CritiqueResult,
  type CritiqueConfig,
  DEFAULT_CRITIQUE_CONFIG,
} from '../../lib/llm/prompts/critic';
import {
  getStructuredOutputMode,
  applyStructuredOutput,
  extractJsonFromResponse,
} from '../../lib/llm/structured-output';
import { ConstitutionSchema } from '../../lib/validation/constitution-schema';
import {
  validateSemantics,
  hasBlockingErrors,
} from '../../lib/validation/semantic-validator';

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

export function hasMissingRequiredAnswers(questions: Question[]): boolean {
  return questions.some((q) => q.required && !q.answer?.trim());
}

export const generatePhase = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    modelId: v.optional(v.string()),
    // Phase 4 P2: Interactive Section Planning - user preferences for sections
    sectionPreferences: v.optional(
      v.array(
        v.object({
          sectionId: v.string(),
          enabled: v.boolean(),
          customInstructions: v.optional(v.string()),
        }),
      ),
    ),
  },
  handler: async (
    ctx: ActionCtx,
    args,
  ): Promise<{ taskId: Id<'generationTasks'> }> => {
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

    // Get phase data
    const phaseData = await ctx.runQuery(
      internalApi.internal.getPhaseInternal,
      {
        projectId: args.projectId,
        phaseId: args.phaseId,
      },
    );
    if (!phaseData) throw new Error('Phase not found');

    const questions = phaseData.questions || [];
    const answeredQuestions = questions.filter((q: Question) => q.answer);

    if (hasMissingRequiredAnswers(questions) && args.phaseId !== 'handoff') {
      throw new Error('Please answer all required questions before generating');
    }

    // Resolve model and credentials (similar to original logic)
    const userConfig = await ctx.runAction(
      api.userConfigActions.getUserConfig,
      {},
    );
    const systemCredentialsMap = await ctx.runAction(
      internalApi.internalActions.getAllDecryptedSystemCredentials,
      {},
    );
    const enabledModelsFromDb = await ctx.runQuery(
      internalApi.llmModels.listEnabledModelsInternal,
    );
    const enabledModels = selectEnabledModels(enabledModelsFromDb || []);
    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {})),
      enabledModels,
    );

    // Validate credentials are available
    if (!credentials) {
      throw new Error(
        'No LLM credentials configured. Please configure your API keys in Settings.',
      );
    }

    let model: LlmModel;
    if (args.modelId) {
      model =
        getModelById(args.modelId, enabledModelsFromDb || []) ??
        getFallbackModel();
    } else if (credentials.modelId) {
      model =
        getModelById(credentials.modelId, enabledModelsFromDb || []) ??
        getFallbackModel();
    } else if (credentials.provider) {
      // Fallback to first enabled model for provider
      const modelId = getFirstEnabledModelForProvider(
        credentials.provider,
        enabledModels,
      );
      model =
        getModelById(modelId, enabledModelsFromDb || []) ?? getFallbackModel();
    } else {
      model = getFallbackModel();
    }

    // Validate provider-model match
    {
      const validation = validateProviderModelMatch(
        credentials.provider,
        model.id,
        enabledModelsFromDb || [],
      );
      if (!validation.valid) {
        console.error(
          `[generatePhase] Provider-model mismatch: ${validation.error}`,
        );
        throw new Error(`Configuration error: ${validation.error}`);
      }
    }

    const artifactType = getArtifactTypeForPhase(args.phaseId);
    const sectionNames = getSectionPlan(artifactType, args.phaseId);
    const questionsText = answeredQuestions
      .map((q: Question) => `${q.text}: ${q.answer}`)
      .join('\n');
    const estimatedTokens =
      estimateTokenCount(
        `${project.title}\n${project.description}\n${questionsText}`,
      ) * 6;

    const sectionPlan = planSectionsForPhase({
      sectionNames,
      estimatedTokens,
      model,
    });

    // Fetch provider API endpoint from models.dev
    let providerApiEndpoint: string | null = null;
    if (credentials.provider) {
      try {
        const providers = await fetchModelDirectory();
        const provider = providers.find((p) => p.id === credentials.provider);
        providerApiEndpoint = provider?.api || null;
        console.log(
          `[generatePhase] Provider ${credentials.provider} API endpoint: ${providerApiEndpoint || 'not found in models.dev'}`,
        );
      } catch (err) {
        console.warn(
          `[generatePhase] Failed to fetch provider API endpoint: ${err}`,
        );
      }
    }

    // Filter section plan based on user preferences (Phase 4 P2)
    let filteredSectionPlan = sectionPlan;
    if (args.sectionPreferences && args.sectionPreferences.length > 0) {
      filteredSectionPlan = sectionPlan.filter((section) => {
        const pref = args.sectionPreferences?.find(
          (p) => p.sectionId === section.name,
        );
        // Default to enabled if no preference set
        return pref?.enabled ?? true;
      });
      console.log(
        `[generatePhase] Filtered section plan: ${filteredSectionPlan.length}/${sectionPlan.length} sections enabled`,
      );
    }

    // Initialize the background task
    const taskId = await ctx.runMutation(
      internalApi.internal.initGenerationTask,
      {
        projectId: args.projectId,
        phaseId: args.phaseId,
        type: 'artifact',
        totalSteps: filteredSectionPlan.length,
        plan: filteredSectionPlan,
        metadata: {
          credentials,
          model,
          artifactType,
          providerApiEndpoint: providerApiEndpoint ?? undefined,
          projectContext: {
            title: project.title,
            description: project.description,
            questions: questionsText,
          },
          // Pass section preferences to worker for custom instructions
          sectionPreferences: args.sectionPreferences ?? [],
        },
      },
    );

    // Update phase status
    await ctx.runMutation(internalApi.internal.updatePhaseStatus, {
      projectId: args.projectId,
      phaseId: args.phaseId,
      status: 'generating',
    });

    // Kick off the worker
    await ctx.scheduler.runAfter(
      0,
      internalApi.internalActions.generatePhaseWorker,
      { taskId },
    );

    return { taskId };
  },
});

interface GenerateSectionsParams {
  ctx: ActionCtx;
  projectId: Id<'projects'>;
  projectContext: {
    title: string;
    description: string;
    questions: string;
  };
  sectionPlan: SectionPlan[];
  model: LlmModel;
  questions: Question[];
  phaseId: string;
  llmClient: ReturnType<typeof createLlmClient>;
  providerInfo: string;
  constitution: string | null;
}

export function planSectionsForPhase(params: {
  sectionNames: string[];
  estimatedTokens: number;
  model: LlmModel;
}): SectionPlan[] {
  const maxTokensPerSection = Math.max(
    256,
    Math.floor(params.model.maxOutputTokens * 0.8),
  );
  const expandedNames = expandSectionsForBudget({
    sectionNames: params.sectionNames,
    estimatedTokens: params.estimatedTokens,
    maxTokensPerSection,
  });
  return planSections(params.model, expandedNames, 0.8);
}

async function generateSectionsWithSelfCritique(
  params: GenerateSectionsParams,
): Promise<{
  sections: Array<{ name: string; content: string; critique?: CritiqueResult }>;
  continuedSections: number;
}> {
  const {
    sectionPlan,
    projectContext,
    model,
    questions,
    phaseId,
    llmClient,
    providerInfo,
    constitution,
  } = params;

  const sections: Array<{
    name: string;
    content: string;
    critique?: CritiqueResult;
  }> = [];
  let continuedSections = 0;

  // Get critique configuration (enabled via feature flag)
  const critiqueConfig = getCritiqueConfig();
  const enableSelfCritique = critiqueConfig.enabled;

  for (let i = 0; i < sectionPlan.length; i++) {
    const section = sectionPlan[i];
    const previousSections = sections.slice(Math.max(0, i - 1), i);
    const sectionQuestions = extractRelevantQuestions(questions, section.name);

    let finalContent: string;
    let critiqueResult: CritiqueResult | undefined;

    if (enableSelfCritique) {
      // Use the new critique-enabled generation flow
      const response = await generateSectionWithCritique({
        projectContext,
        sectionName: section.name,
        sectionInstructions: getSectionInstructions(phaseId, section.name),
        sectionQuestions,
        previousSections,
        model,
        maxTokens: section.maxTokens,
        llmClient,
        providerInfo,
        phaseId,
        constitution,
        config: critiqueConfig,
      });

      finalContent = response.content;
      critiqueResult = response.critique;

      if (response.continued) {
        continuedSections += 1;
      }

      console.log(
        `[generateSectionsWithSelfCritique] Section "${section.name}" - Score: ${critiqueResult?.score ?? 'N/A'}, Refined: ${response.refined}`,
      );
    } else {
      // Use standard generation without critique
      const response = await generateSectionContent({
        projectContext,
        sectionName: section.name,
        sectionInstructions: getSectionInstructions(phaseId, section.name),
        sectionQuestions,
        previousSections,
        model,
        maxTokens: section.maxTokens,
        llmClient,
        providerInfo,
        phaseId,
        constitution,
      });

      finalContent = response.content;

      if (response.continued) {
        continuedSections += 1;
      }
    }

    sections.push({
      name: section.name,
      content: stripLeadingHeading(finalContent),
      critique: critiqueResult,
    });
  }

  return { sections, continuedSections };
}

export async function generateSectionContent(params: {
  projectContext: { title: string; description: string; questions: string };
  sectionName: string;
  sectionInstructions: string;
  sectionQuestions: string[];
  previousSections: Array<{ name: string; content: string }>;
  model: LlmModel;
  maxTokens: number;
  llmClient: ReturnType<typeof createLlmClient>;
  providerInfo: string;
  phaseId: string;
  constitution: string | null;
}): Promise<{ content: string; continued: boolean }> {
  const { llmClient, model, maxTokens, constitution } = params;

  // Guard: No LLM client available
  if (!llmClient) {
    console.warn(
      '[generateSectionContent] No LLM client available, using fallback',
    );
    return {
      content: `## ${formatSectionName(params.sectionName)}\n\n_Content generation requires LLM configuration. Please configure your API keys in Settings._`,
      continued: false,
    };
  }

  // Build the prompt
  let systemPrompt = `You are an expert technical writer creating project documentation.
Generate the "${params.sectionName}" section for a ${params.phaseId} document.

Project: ${params.projectContext.title}
Description: ${params.projectContext.description}

${params.projectContext.questions ? `User Requirements & Clarifications:\n${params.projectContext.questions}\n` : ''}
${params.sectionInstructions}

Requirements:
- Use markdown formatting
- Be thorough and detailed
- Include specific, actionable content
- Reference the project context throughout
- Output ONLY document content — no reasoning, analysis, or meta-commentary
- Do NOT include <thinking>, <think>, <reasoning>, or any XML reasoning tags
- Do NOT prefix with numbered reasoning steps (e.g. "Step 1: Analyze...")
- Do NOT include internal checklists, confidence scores, or analysis headers
- Do NOT narrate what you are doing (e.g. "I'll structure this as...", "Let me think...")`;

  // Inject constitution context if available and phase requires it
  if (constitution && shouldInjectConstitution(params.phaseId)) {
    systemPrompt = injectConstitutionContext(systemPrompt, constitution);
  }

  const userPrompt = `${
    params.previousSections.length > 0
      ? `Previous sections for context:\n${params.previousSections.map((s) => `## ${s.name}\n${s.content}`).join('\n\n')}\n\n`
      : ''
  }
${
  params.sectionQuestions.length > 0
    ? `Address these points:\n${params.sectionQuestions.map((q) => `- ${q}`).join('\n')}\n\n`
    : ''
}
Generate the "${params.sectionName}" section now:`;

  const basePrompt = `${systemPrompt}\n\n${userPrompt}`;

  const startedAt = Date.now();
  try {
    const response = await continueIfTruncated({
      prompt: basePrompt,
      maxTurns: 3,
      continuationPrompt: (soFar) => {
        const tail = soFar.length > 1500 ? soFar.slice(-1500) : soFar;
        return `${systemPrompt}\n\nYou are continuing a document that was cut off. Output ONLY the next part of the document content. Do NOT analyze, plan, summarize, or describe what you are doing. Do NOT output any reasoning or meta-commentary. Write markdown document content ONLY.\n\n===DOCUMENT SO FAR===\n${tail}\n===END===\n\nContinue the document from exactly where it left off:`;
      },
      complete: (prompt) =>
        retryWithBackoff(
          () =>
            llmClient.complete(prompt, {
              model: model.id,
              maxTokens: Math.min(maxTokens, model.maxOutputTokens),
              temperature: 0.7,
            }),
          { retries: 3, minDelayMs: 500, maxDelayMs: 4000 },
        ),
    });

    const durationMs = Date.now() - startedAt;
    logTelemetry('info', {
      provider: model.provider,
      model: model.id,
      durationMs,
      success: true,
    });

    return {
      content: sanitizeGeneratedContent(response.content),
      continued: response.continued,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    logTelemetry('warn', {
      provider: model.provider,
      model: model.id,
      durationMs,
      success: false,
      error: error?.message ?? String(error),
    });
    console.error(`[generateSectionContent] LLM call failed:`, error?.message);
    throw new Error(
      `Failed to generate ${params.sectionName}: ${error?.message}`,
    );
  }
}

export async function generateSectionContentStreaming(params: {
  projectContext: { title: string; description: string; questions: string };
  sectionName: string;
  sectionInstructions: string;
  sectionQuestions: string[];
  previousSections: Array<{ name: string; content: string }>;
  model: LlmModel;
  maxTokens: number;
  chunkMaxTokens: number;
  maxTurns: number;
  llmClient: ReturnType<typeof createLlmClient>;
  providerInfo: string;
  phaseId: string;
  onChunk: (delta: string, finishReason?: string) => Promise<void>;
}): Promise<{ content: string; continued: boolean }> {
  const { llmClient, model } = params;

  if (!llmClient) {
    return {
      content: `## ${formatSectionName(params.sectionName)}\n\n_Content generation requires LLM configuration. Please configure your API keys in Settings._`,
      continued: false,
    };
  }

  const systemPrompt = `You are an expert technical writer creating project documentation.
Generate the "${params.sectionName}" section for a ${params.phaseId} document.

Project: ${params.projectContext.title}
Description: ${params.projectContext.description}

${params.projectContext.questions ? `User Requirements & Clarifications:\n${params.projectContext.questions}\n` : ''}
${params.sectionInstructions}

Requirements:
- Use markdown formatting
- Be thorough and detailed
- Include specific, actionable content
- Reference the project context throughout
- Output ONLY document content — no reasoning, analysis, or meta-commentary
- Do NOT include <thinking>, <think>, <reasoning>, or any XML reasoning tags
- Do NOT prefix with numbered reasoning steps (e.g. "Step 1: Analyze...")
- Do NOT include internal checklists, confidence scores, or analysis headers
- Do NOT narrate what you are doing (e.g. "I'll structure this as...", "Let me think...")`;

  const userPrompt = `${
    params.previousSections.length > 0
      ? `Previous sections for context:\n${params.previousSections.map((s) => `## ${s.name}\n${s.content}`).join('\n\n')}\n\n`
      : ''
  }
${
  params.sectionQuestions.length > 0
    ? `Address these points:\n${params.sectionQuestions.map((q) => `- ${q}`).join('\n')}\n\n`
    : ''
}
Generate the "${params.sectionName}" section now:`;

  const startedAt = Date.now();
  try {
    const response = await continueIfTruncated({
      prompt: userPrompt,
      maxTurns: params.maxTurns,
      continuationPrompt: (soFar) => {
        const tail = soFar.length > 1500 ? soFar.slice(-1500) : soFar;
        return `You are continuing a document that was cut off. Output ONLY the next part of the document content. Do NOT analyze, plan, summarize, or describe what you are doing. Do NOT output any reasoning or meta-commentary. Write markdown document content ONLY.\n\n===DOCUMENT SO FAR===\n${tail}\n===END===\n\nContinue the document from exactly where it left off:`;
      },
      sanitizeDelta: sanitizeGeneratedContent,
      complete: (prompt) =>
        retryWithBackoff(
          () =>
            llmClient.complete(prompt, {
              model: model.id,
              maxTokens: Math.min(
                params.chunkMaxTokens,
                params.maxTokens,
                model.maxOutputTokens,
              ),
              temperature: 0.7,
              systemPrompt,
            }),
          { retries: 3, minDelayMs: 500, maxDelayMs: 4000 },
        ),
      onTurn: async ({ delta, finishReason }) => {
        await params.onChunk(delta, finishReason);
      },
    });

    const durationMs = Date.now() - startedAt;
    logTelemetry('info', {
      provider: model.provider,
      model: model.id,
      durationMs,
      success: true,
    });

    return {
      content: sanitizeGeneratedContent(response.content),
      continued: response.continued,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    logTelemetry('warn', {
      provider: model.provider,
      model: model.id,
      durationMs,
      success: false,
      error: error?.message ?? String(error),
    });
    console.error(
      `[generateSectionContentStreaming] LLM call failed:`,
      error?.message,
    );
    throw new Error(
      `Failed to generate ${params.sectionName}: ${error?.message}`,
    );
  }
}

/**
 * Strips chain-of-thought meta-reasoning that leaked into generated content.
 * Covers all major LLM providers: OpenAI, Anthropic/Claude, DeepSeek, Gemini, Mistral, etc.
 * This is the LAST LINE OF DEFENSE — prompts should prevent CoT, but this catches leaks.
 */
export function sanitizeGeneratedContent(content: string): string {
  const cotPatterns = [
    // ── Provider-specific XML reasoning blocks ──
    // Claude <thinking>...</thinking>, DeepSeek <think>...</think>
    /<(?:thinking|think|reasoning|reflection|inner_monologue)>[\s\S]*?<\/(?:thinking|think|reasoning|reflection|inner_monologue)>/gi,

    // ── Bold/header reasoning blocks ──
    // "1. **Analyze the Request:**" (numbered bold analysis)
    /^\d+\.\s+\*\*[A-Z][^*]+:\*\*[\s\S]*?(?=^#{1,3}\s|\n\n---|$)/gm,
    // "**Thinking:**", "**Analysis:**", "**My Approach:**", "**Planning:**"
    /^\*\*(?:Thinking|Analysis|Planning|Reasoning|My [Aa]pproach|Internal [Nn]otes?|Chain of [Tt]hought|Constraint Checklist|Mental Sandbox|Confidence Score)(?::?\s*)\*\*[\s\S]*?(?=^#{1,3}\s|\n\n---|$)/gm,
    // "### Thinking", "## Analysis" (heading-style reasoning)
    /^#{1,4}\s+(?:Thinking|Analysis|Planning|Reasoning|My Approach|Internal Notes?|Chain of Thought)\s*\n[\s\S]*?(?=^#{1,3}\s|\n\n---|$)/gm,

    // ── "Draft thought" blocks ──
    /^\*?Draft thought\*?[\s\S]*?(?=^#{1,3}\s|\n\n---|$)/gm,

    // ── Self-referential reasoning lines (single-line) ──
    /^(?:The user wants me to|I need to|Let me (?:think|analyze|consider|break|plan|draft|approach|structure|organize|start|look)|Looking at this|If I (?:look|think|consider)|I should (?:focus|start|begin|consider|address)|I'll (?:structure|organize|start|begin|approach|break|analyze|create|draft)|I will (?:now )?(?:generate|create|write|draft|produce|structure)|First,? (?:let me|I need to|I'll|I will)|Based on (?:the|this|my) (?:analysis|review|assessment))\b[^\n]*\n?/gm,

    // ── Preambles and meta-commentary ──
    // "Okay, let's...", "Alright, here's what..."
    /^(?:Okay|Alright|So|Now|Right|Well|Sure),?\s+(?:let's|I'll|I will|here's what|based on|let me)[^\n]*\n?/gim,
    // "Here's my plan:", "Here is what I will do:", "Here's how I'll approach this:"
    /^(?:Here(?:'s| is) (?:my |what |how )[^\n]*:)\s*\n?/gim,

    // ── Numbered plain-text reasoning steps ──
    // "Step 1: Analyze..." / "Step 2: Consider..." (but NOT "Step 1:" inside actual document steps with content below)
    /^Step \d+:\s*(?:Analyz|Consider|Think|Plan|Review|Assess|Evaluat|Determin|Identif|Understand|Examin|Break down|First|Now)[^\n]*\n?/gim,

    // ── Bracketed internal markers ──
    // "[Internal]", "[Note to self]", "[Planning]", "[Reasoning]"
    /^\[(?:Internal|Note to self|Planning|Reasoning|Thinking|Analysis|Draft)\][^\n]*\n?/gim,

    // ── Fenced reasoning blocks (divider-enclosed) ──
    // "---\nThinking about this...\n---"
    /^---\n(?:(?!#{1,3}\s)[\s\S])*?(?:thinking|reasoning|analysis|my approach|let me|I need to)[\s\S]*?\n---\n?/gim,
  ];

  let cleaned = content;
  for (const pattern of cotPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Collapse excessive blank lines left by removals
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  return cleaned.trim();
}

export function extractRelevantQuestions(
  questions: Question[],
  sectionName: string,
): string[] {
  const keywords: Record<string, string[]> = {
    // Constitution
    'locked-constraints': [
      'constraint',
      'security',
      'invariant',
      'rule',
      'protocol',
      'strict',
    ],
    'architecture-decisions': [
      'architecture',
      'state',
      'api',
      'pattern',
      'decision',
      'system',
    ],
    'tech-stack': [
      'tech',
      'stack',
      'framework',
      'database',
      'language',
      'tool',
    ],
    'quality-and-standards': [
      'quality',
      'standard',
      'accessibility',
      'performance',
      'test',
      'wcag',
    ],

    // Brief
    'executive-summary': ['goal', 'problem', 'success'],
    'problem-and-objectives': ['goal', 'problem', 'objective'],
    'features-and-requirements': ['feature', 'requirement', 'constraint'],

    // PRD
    'problem-statement': ['problem', 'challenge', 'pain'],
    'goals-and-objectives': ['goal', 'objective', 'success'],
    'user-personas': ['user', 'persona', 'audience'],
    requirements: ['requirement', 'feature', 'constraint'],
    'success-metrics': ['metric', 'kpi', 'success'],

    // Domain Model
    'entity-definitions': ['entity', 'data', 'model', 'attribute', 'domain'],
    'entity-relationships': ['relationship', 'owner', 'relation', 'connection'],
    'state-transitions': ['state', 'transition', 'lifecycle', 'status'],

    // Specs
    'architecture-overview': ['architecture', 'cloud', 'infrastructure'],
    'data-models-and-api': ['data', 'database', 'schema', 'api'],
    'deployment-and-security': ['deployment', 'security', 'auth'],

    // Stories
    'user-stories': ['user', 'persona', 'feature'],
    'technical-tasks': ['task', 'dependency', 'implementation'],

    // Artifacts & Handoff
    documentation: ['documentation', 'api', 'schema'],
    configuration: ['configuration', 'environment', 'setup'],
    'deployment-guide': ['deployment', 'release', 'infrastructure'],
    'project-summary': ['summary', 'architecture', 'structure'],
    'setup-guide': ['setup', 'environment', 'install'],
    'next-steps': ['next', 'roadmap', 'follow-up'],
  };

  const relevantKeywords = keywords[sectionName] || [];

  return questions
    .filter(
      (q) =>
        q.answer &&
        relevantKeywords.some((kw) => q.text.toLowerCase().includes(kw)),
    )
    .map((q) => `${q.text}: ${q.answer}`);
}

export function stripLeadingHeading(content: string): string {
  return content.replace(/^#{1,6}\s+.*\n+/, '').trim();
}

export function getSectionInstructions(
  phaseId: string,
  sectionName: string,
): string {
  const instructions: Record<string, string> = {
    // Constitution sections
    'locked-constraints':
      'Define immutable truths including state invariants, domain rules, and non-negotiable security protocols.',
    'architecture-decisions':
      'Outline high-level architecture patterns, state management approaches, and API design principles.',
    'tech-stack':
      'Specify frameworks, runtimes, databases, ORMs, and styling approaches with strict version constraints.',
    'quality-and-standards':
      'Set non-negotiable requirements for accessibility (WCAG), performance, security, and test coverage.',

    // Brief sections
    'problem-and-objectives':
      'Clearly articulate the problem this project solves and define specific, measurable goals with success criteria.',
    'features-and-requirements':
      'Outline the core features, functionality required, and any technical constraints or compliance requirements.',

    // PRD sections
    'executive-summary':
      'Provide a concise overview of the project goals, target users, and key deliverables.',
    'problem-statement':
      'Clearly articulate the problem space, current challenges, pain points, and why this project is necessary.',
    'goals-and-objectives':
      'Define specific, measurable, achievable, relevant, and time-bound (SMART) goals and success criteria.',
    'user-personas':
      'Describe the target user personas, their characteristics, goals, pain points, and how they will interact with the product.',
    requirements:
      'List all functional and non-functional requirements, organized by priority and category.',
    'success-metrics':
      'Define key performance indicators (KPIs), metrics for success, and how they will be measured and tracked.',

    // Domain Model sections
    'entity-definitions':
      'Define core domain entities, their purpose, attributes, and invariants.',
    'entity-relationships':
      'Describe cardinality and ownership relationships between entities.',
    'state-transitions':
      'Map entity lifecycle states, transitions, and governing business guards.',

    // Specs sections
    'architecture-overview':
      'Describe the high-level system architecture, design patterns, and technology choices.',
    'data-models-and-api':
      'Define core data structures, entities, relationships, and API contracts.',
    'deployment-and-security':
      'Describe deployment strategy, infrastructure, authentication, authorization, and security requirements.',

    // Stories sections
    'epic-overview':
      'Provide an overview of the main epics and how they relate to project goals.',
    'user-stories':
      'List user stories with acceptance criteria in proper format.',
    'technical-tasks':
      'Break down user stories into technical implementation tasks with dependencies.',

    // Artifacts sections
    documentation:
      'Generate API documentation and database schema documentation.',
    configuration: 'Provide configuration files and infrastructure setup.',
    'deployment-guide': 'Create step-by-step deployment instructions.',

    // Handoff sections
    'project-summary':
      'Summarize the project structure, key files, and architecture.',
    'setup-guide':
      'Provide environment setup and development guide instructions.',
    'next-steps': 'List recommended next steps and priorities for development.',
  };

  return (
    instructions[sectionName] ||
    `Generate comprehensive content for the ${sectionName} section.`
  );
}

function formatSectionName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPhaseTitle(phaseId: string): string {
  const titles: Record<string, string> = {
    constitution: 'Project Constitution',
    brief: 'Project Brief',
    prd: 'Product Requirements Document',
    domainModel: 'Domain Model',
    specs: 'Technical Specifications',
    stories: 'User Stories & Tasks',
    artifacts: 'Technical Artifacts',
    handoff: 'Project Handoff',
  };
  return titles[phaseId] || 'Document';
}

/**
 * Generates a Project Constitution from the project brief content.
 * This constitution serves as the single source of truth for all subsequent phases.
 */
export async function generateConstitution(params: {
  ctx: ActionCtx;
  projectId: Id<'projects'>;
  projectContext: {
    title: string;
    description: string;
    questions: string;
  };
  model: LlmModel;
  llmClient: ReturnType<typeof createLlmClient>;
  providerInfo: string;
}): Promise<{
  content: string;
  success: boolean;
  parseError?: boolean;
  semanticWarnings?: import('../../lib/validation/semantic-validator').SemanticWarning[];
  hasSemanticErrors?: boolean;
}> {
  const { llmClient, model, projectContext } = params;

  // Guard: No LLM client available
  if (!llmClient) {
    console.warn('[generateConstitution] No LLM client available');
    return {
      content: '',
      success: false,
    };
  }

  const constitutionPrompt = `${CONSTITUTION_PROMPT}

## Project Context
Title: ${projectContext.title}
Description: ${projectContext.description}

${projectContext.questions ? `Additional Context:\n${projectContext.questions}` : ''}

Generate the Project Constitution now:`;

  const startedAt = Date.now();
  try {
    // Convert Zod schema to JSON Schema for structured output
    let jsonSchema: object = {};
    try {
      const { zodToJsonSchema } = await import('zod-to-json-schema');
      // @ts-expect-error - zod-to-json-schema types may not match Zod v4 exactly
      jsonSchema = zodToJsonSchema(ConstitutionSchema, {
        name: 'ProjectConstitution',
        $refStrategy: 'none',
      });
    } catch (importError) {
      console.warn(
        '[generateConstitution] Failed to import zod-to-json-schema, falling back to regex extraction',
      );
    }

    // Get the best structured output mode for this provider
    const structuredMode = getStructuredOutputMode(model.provider, jsonSchema);

    console.log(
      `[generateConstitution] Using structured output mode: ${structuredMode.type} for provider: ${model.provider}`,
    );

    // Build request body with structured output if supported
    const requestBody: Record<string, unknown> = {
      model: model.id,
      maxTokens: Math.min(4000, model.maxOutputTokens),
      temperature: 0.3, // Lower temperature for consistency
    };

    // Apply structured output configuration
    const enhancedRequestBody = applyStructuredOutput(
      requestBody,
      structuredMode,
    );

    const response = await retryWithBackoff(
      () =>
        llmClient.complete(constitutionPrompt, {
          model: requestBody.model as string,
          maxTokens: requestBody.maxTokens as number,
          temperature: requestBody.temperature as number,
        }),
      { retries: 3, minDelayMs: 500, maxDelayMs: 4000 },
    );

    // Extract JSON based on the structured output mode used
    const extractedContent = extractJsonFromResponse(
      response.content,
      structuredMode,
    );

    // Parse and validate the constitution
    let parsedConstitution;
    try {
      parsedConstitution = JSON.parse(extractedContent);
    } catch (parseError) {
      console.warn(
        '[generateConstitution] Failed to parse constitution JSON:',
        parseError,
      );
      // Return the raw content for manual review
      const durationMs = Date.now() - startedAt;
      logTelemetry('warn', {
        provider: model.provider,
        model: model.id,
        durationMs,
        success: false,
        error: 'Failed to parse constitution JSON',
      });
      return {
        content: extractedContent,
        success: true, // Still return success with raw content
        parseError: true,
      };
    }

    // Run semantic validation
    const semanticWarnings = validateSemantics(parsedConstitution);
    const hasErrors = hasBlockingErrors(semanticWarnings);

    if (semanticWarnings.length > 0) {
      console.log(
        `[generateConstitution] Semantic validation found ${semanticWarnings.length} issues:`,
        semanticWarnings.map((w) => `${w.severity}: ${w.message}`),
      );
    }

    const durationMs = Date.now() - startedAt;
    logTelemetry('info', {
      provider: model.provider,
      model: model.id,
      durationMs,
      success: true,
      structuredOutputMode: structuredMode.type,
      semanticWarnings: semanticWarnings.length,
      semanticErrors: semanticWarnings.filter((w) => w.severity === 'error')
        .length,
    });

    return {
      content: extractedContent,
      success: true,
      semanticWarnings: hasErrors ? semanticWarnings : undefined,
      hasSemanticErrors: hasErrors,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    logTelemetry('warn', {
      provider: model.provider,
      model: model.id,
      durationMs,
      success: false,
      error: error?.message ?? String(error),
    });
    console.error(`[generateConstitution] Failed:`, error?.message);
    return {
      content: '',
      success: false,
    };
  }
}

/**
 * Fetches the constitution artifact for a project.
 * Returns null if no constitution exists.
 */
export async function fetchConstitutionForProject(
  ctx: ActionCtx,
  projectId: Id<'projects'>,
): Promise<string | null> {
  try {
    // Query by type='hidden_constitution' to get the constitution artifact
    // Constitution is stored as a hidden artifact with type='hidden_constitution'
    const artifact = await ctx.runQuery(
      internalApi.internal.getArtifactByTypeInternal,
      { projectId, type: 'hidden_constitution' },
    );

    if (artifact && artifact.content) {
      return artifact.content;
    }

    return null;
  } catch (error) {
    console.warn(
      '[fetchConstitutionForProject] Failed to fetch constitution:',
      error,
    );
    return null;
  }
}

/**
 * Determines if constitution context should be injected for a given phase.
 * Constitution is generated during Brief phase and used for all subsequent phases.
 */
export function shouldInjectConstitution(phaseId: string): boolean {
  // Constitution is generated during Constitution phase, so we don't inject it there
  // For all other phases, we inject the constitution
  return phaseId !== 'constitution';
}

// ============================================================================
// CRITIQUE FUNCTIONS (Phase 2 P1 - Recursive Self-Critique)
// ============================================================================

/**
 * Runs a critique on generated section content against the Project Constitution
 * and Definition of Done criteria.
 */
export async function critiqueSection(params: {
  constitution: string | null;
  sectionContent: string;
  sectionName: string;
  sectionType: string;
  phaseId: string;
  model: LlmModel;
  llmClient: ReturnType<typeof createLlmClient>;
}): Promise<CritiqueResult> {
  const {
    llmClient,
    model,
    constitution,
    sectionContent,
    sectionName,
    sectionType,
    phaseId,
  } = params;

  // Guard: No LLM client available or critique not applicable
  if (!llmClient) {
    console.warn('[critiqueSection] No LLM client available');
    return {
      passes: true,
      score: 100,
      summary: 'Critique skipped - no LLM client',
      violations: [],
    };
  }

  // Guard: No constitution available
  if (!constitution) {
    console.warn('[critiqueSection] No constitution available for critique');
    return {
      passes: true,
      score: 100,
      summary: 'Critique skipped - no constitution',
      violations: [],
    };
  }

  // Guard: Phase doesn't benefit from critique
  if (!shouldCritiquePhase(phaseId)) {
    console.log(`[critiqueSection] Skipping critique for phase: ${phaseId}`);
    return {
      passes: true,
      score: 100,
      summary: `Critique skipped for ${phaseId} phase`,
      violations: [],
    };
  }

  const criticPrompt = buildCriticPrompt({
    constitution,
    sectionContent,
    sectionName,
    sectionType,
    phaseId,
  });

  const startedAt = Date.now();
  try {
    const response = await retryWithBackoff(
      () =>
        llmClient.complete(criticPrompt, {
          model: model.id,
          maxTokens: Math.min(4000, model.maxOutputTokens),
          temperature: 0.2, // Low temperature for consistent evaluation
        }),
      { retries: 2, minDelayMs: 500, maxDelayMs: 3000 },
    );

    const critiqueResult = parseCritiqueResult(response.content);

    const durationMs = Date.now() - startedAt;
    logTelemetry('info', {
      provider: model.provider,
      model: model.id,
      durationMs,
      success: true,
    });

    return critiqueResult;
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    logTelemetry('warn', {
      provider: model.provider,
      model: model.id,
      durationMs,
      success: false,
      error: error?.message ?? String(error),
    });
    console.error(`[critiqueSection] Failed:`, error?.message);

    // Return a failing result on error
    return {
      passes: false,
      score: 0,
      summary: 'Critique failed due to error',
      violations: [
        {
          category: 'completeness',
          severity: 'critical',
          criterion: 'Critique Execution',
          issue: `Critique failed: ${error?.message ?? 'Unknown error'}`,
          suggestion: 'Review the section manually for quality issues',
        },
      ],
    };
  }
}

/**
 * Generates a section with critique and optional retry on failure.
 * Implements the Recursive Self-Critique pattern from Phase 2 P1.
 */
export async function generateSectionWithCritique(params: {
  projectContext: { title: string; description: string; questions: string };
  sectionName: string;
  sectionInstructions: string;
  sectionQuestions: string[];
  previousSections: Array<{ name: string; content: string }>;
  model: LlmModel;
  maxTokens: number;
  llmClient: ReturnType<typeof createLlmClient>;
  providerInfo: string;
  phaseId: string;
  constitution: string | null;
  config?: CritiqueConfig;
  retryCount?: number;
}): Promise<{
  content: string;
  continued: boolean;
  critique?: CritiqueResult;
  refined: boolean;
}> {
  const config = params.config ?? DEFAULT_CRITIQUE_CONFIG;
  const retryCount = params.retryCount ?? 0;

  // Step 1: Generate initial section content
  const generationResult = await generateSectionContent({
    projectContext: params.projectContext,
    sectionName: params.sectionName,
    sectionInstructions: params.sectionInstructions,
    sectionQuestions: params.sectionQuestions,
    previousSections: params.previousSections,
    model: params.model,
    maxTokens: params.maxTokens,
    llmClient: params.llmClient,
    providerInfo: params.providerInfo,
    phaseId: params.phaseId,
    constitution: params.constitution,
  });

  // Step 2: Run critique (if enabled)
  let critiqueResult: CritiqueResult | undefined;
  let finalContent = generationResult.content;
  let wasRefined = false;

  if (config.enabled) {
    critiqueResult = await critiqueSection({
      constitution: params.constitution,
      sectionContent: generationResult.content,
      sectionName: params.sectionName,
      sectionType: params.phaseId,
      phaseId: params.phaseId,
      model: params.model,
      llmClient: params.llmClient,
    });

    // Step 3: If critique fails and we haven't exceeded max retries, regenerate
    if (!critiqueResult.passes && retryCount < config.maxRetries) {
      console.log(
        `[generateSectionWithCritique] Section "${params.sectionName}" failed critique (score: ${critiqueResult.score}). Retrying (${retryCount + 1}/${config.maxRetries})...`,
      );

      // Build enhanced instructions with critique feedback
      const enhancedInstructions = `${params.sectionInstructions}

## CRITIQUE FEEDBACK (Address These Issues)
${critiqueResult.violations.map((v) => `- [${v.severity.toUpperCase()}] ${v.category}: ${v.issue}. ${v.suggestion}`).join('\n')}

## REFINEMENT REQUIREMENTS
Please address ALL the issues above in your revision. The section must achieve a score of ${config.passThreshold} or higher.`;

      // Recursive call with enhanced instructions
      const retryResult = await generateSectionWithCritique({
        ...params,
        sectionInstructions: enhancedInstructions,
        retryCount: retryCount + 1,
      });

      return {
        ...retryResult,
        refined: true,
      };
    }

    // If critique passes or we've exhausted retries, use the content
    // If critique provided a refined section, use it
    if (
      critiqueResult.refinedSection &&
      critiqueResult.refinedSection.length > 0
    ) {
      finalContent = critiqueResult.refinedSection;
      wasRefined = true;
    }
  }

  return {
    content: finalContent,
    continued: generationResult.continued,
    critique: critiqueResult,
    refined: wasRefined,
  };
}

/**
 * Determines if critique should be enabled based on feature flags and configuration.
 * For SpecForge 2026 Verification Layer, this is MANDATORY for all generating phases.
 */
export function isCritiqueEnabled(): boolean {
  return true; // Mandatory Generation -> Critique -> Refine loop
}

/**
 * Gets the critique configuration from environment or defaults.
 */
export function getCritiqueConfig(): CritiqueConfig {
  return {
    enabled: isCritiqueEnabled(),
    maxRetries: parseInt(
      process.env.CRITIQUE_MAX_RETRIES ??
        String(DEFAULT_CRITIQUE_CONFIG.maxRetries),
      10,
    ),
    passThreshold: parseInt(
      process.env.CRITIQUE_PASS_THRESHOLD ??
        String(DEFAULT_CRITIQUE_CONFIG.passThreshold),
      10,
    ),
    categories: {
      accessibility: process.env.CRITIQUE_ACCESSIBILITY !== 'false',
      performance: process.env.CRITIQUE_PERFORMANCE !== 'false',
      security: process.env.CRITIQUE_SECURITY !== 'false',
      architecture: process.env.CRITIQUE_ARCHITECTURE !== 'false',
      completeness: process.env.CRITIQUE_COMPLETENESS !== 'false',
    },
  };
}

/**
 * Detects if the generated Technical Specs or Constitution differ fundamentally from the original PRD/Brief.
 * If significant drift is found, generates a "PRD Update Suggestion" (Living Spec).
 */
export async function detectPrdDrift(params: {
  ctx: ActionCtx;
  projectId: Id<'projects'>;
  projectContext: {
    title: string;
    description: string;
    questions: string;
  };
  model: LlmModel;
  llmClient: ReturnType<typeof createLlmClient>;
  providerInfo: string;
  constitution: string;
}): Promise<{ content: string; hasDrift: boolean }> {
  const { llmClient, model, projectContext, constitution } = params;

  if (!llmClient) {
    return { content: '', hasDrift: false };
  }

  const prompt = `You are a Principal AI Architect maintaining the "Living Spec" of a software project.
Your job is to compare the Original Project Brief/PRD against the finalized Project Constitution (the technical truth).
If the Constitution contains architectural decisions, tech stack choices, or constraints that fundamentally alter or expand upon the original Brief, you must document this drift.

## Original Project Brief
Title: ${projectContext.title}
Description: ${projectContext.description}

## Finalized Project Constitution
${constitution}

Analyze the two documents. If the Constitution introduces significant technical constraints, new patterns, or shifts in scope not present in the brief, return a JSON object with:
{
  "hasDrift": true,
  "driftSummary": "Markdown formatted string describing the new technical realities, constraints, and suggesting specific updates to the PRD."
}
If they are perfectly aligned and no PRD updates are needed, return:
{
  "hasDrift": false,
  "driftSummary": ""
}

Return ONLY valid JSON. Nothing else.`;

  try {
    const response = await retryWithBackoff(
      () =>
        llmClient.complete(prompt, {
          model: model.id,
          maxTokens: 1500,
          temperature: 0.2, // Low temp for analytical task
        }),
      { retries: 2, minDelayMs: 500, maxDelayMs: 2000 },
    );

    // Extract JSON from response
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const rawContent = jsonMatch
      ? jsonMatch[1].trim()
      : response.content.trim();

    const result = JSON.parse(rawContent);
    return {
      hasDrift: result.hasDrift === true,
      content: result.driftSummary || '',
    };
  } catch (error) {
    console.error('[detectPrdDrift] Error:', error);
    return { content: '', hasDrift: false };
  }
}

/**
 * Generalized drift detection for any phase against the constitution.
 * Runs after every phase completion to catch drift early.
 */
export async function detectPhaseDrift(params: {
  ctx: ActionCtx;
  projectId: Id<'projects'>;
  phaseId: string;
  phaseContent: string;
  projectContext: {
    title: string;
    description: string;
    questions: string;
  };
  model: LlmModel;
  llmClient: ReturnType<typeof createLlmClient>;
  constitution: string;
  featureFlag?: boolean; // Allow disabling to control costs
}): Promise<{ content: string; hasDrift: boolean }> {
  const {
    llmClient,
    model,
    phaseId,
    phaseContent,
    constitution,
    featureFlag = true,
  } = params;

  // Skip if feature flag is disabled (cost control)
  if (!featureFlag) {
    return { content: '', hasDrift: false };
  }

  if (!llmClient) {
    return { content: '', hasDrift: false };
  }

  // Skip for early phases that don't have meaningful content yet
  if (['constitution', 'brief'].includes(phaseId)) {
    return { content: '', hasDrift: false };
  }

  const prompt = `You are a Principal AI Architect maintaining the "Living Spec" of a software project.
Your job is to compare the generated ${phaseId} phase artifact against the Project Constitution (the technical truth).
If the artifact contains content that contradicts, deviates from, or expands beyond the constraints defined in the Constitution, you must document this drift.

## Project Constitution (Technical Truth)
${constitution}

## Generated ${phaseId} Phase Content
${phaseContent.slice(0, 3000)} ${phaseContent.length > 3000 ? '... (truncated)' : ''}

Analyze the two documents. If the ${phaseId} phase introduces content that:
1. Contradicts the Constitution's constraints or tech stack
2. Uses patterns or technologies not allowed by forbiddenPatterns
3. Violates quality standards defined in the Constitution
4. Significantly expands scope beyond what's defined

Return a JSON object with:
{
  "hasDrift": true,
  "driftSummary": "Markdown formatted string describing the drift, specific contradictions, and recommendations for alignment."
}

If the content is perfectly aligned with the Constitution, return:
{
  "hasDrift": false,
  "driftSummary": ""
}

Return ONLY valid JSON. Nothing else.`;

  try {
    const response = await retryWithBackoff(
      () =>
        llmClient.complete(prompt, {
          model: model.id,
          maxTokens: 1000,
          temperature: 0.2,
        }),
      { retries: 2, minDelayMs: 500, maxDelayMs: 2000 },
    );

    // Extract JSON from response
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const rawContent = jsonMatch
      ? jsonMatch[1].trim()
      : response.content.trim();

    const result = JSON.parse(rawContent);
    return {
      hasDrift: result.hasDrift === true,
      content: result.driftSummary || '',
    };
  } catch (error) {
    console.error('[detectPhaseDrift] Error:', error);
    return { content: '', hasDrift: false };
  }
}
