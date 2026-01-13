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
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import type { SectionPlan, ProviderCredentials, LlmModel } from '../../lib/llm/types';
import { getArtifactTypeForPhase } from '../../lib/llm/artifact-types';
import type { SystemCredential } from '../../lib/llm/registry';
import { createLlmClient } from '../../lib/llm/client-factory';
import { retryWithBackoff } from '../../lib/llm/retry';
import { continueIfTruncated } from '../../lib/llm/continuation';
import { rateLimiter } from '../rateLimiter';
import { renderPreviewHtml } from '../../lib/markdown-render';
import { buildTelemetry } from '../../lib/llm/telemetry';

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
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{
    artifactId: Id<'artifacts'>;
    status: string;
    continuedSections: number;
  }> => {
    const project = await ctx.runQuery(api.projects.getProject, {
      projectId: args.projectId,
    });
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    const userId = identity.tokenIdentifier;

    // Rate limiting - per-user limit
    const userLimit = await rateLimiter.limit(ctx, "generatePhase", {
      key: userId,
      throws: true,
    });

    // Rate limiting - global limit
    await rateLimiter.limit(ctx, "globalPhaseGen", { throws: true });

    // Get phase data with questions
    const phaseData = await ctx.runQuery(api.projects.getPhase, {
      projectId: args.projectId,
      phaseId: args.phaseId,
    });

    if (!phaseData) throw new Error('Phase not found');

    const questions = phaseData.questions || [];
    const answeredQuestions = questions.filter((q: Question) => q.answer);

    if (hasMissingRequiredAnswers(questions) && args.phaseId !== 'handoff') {
      throw new Error(
        'Please answer all required questions before generating'
      );
    }

    if (answeredQuestions.length === 0 && args.phaseId !== 'handoff') {
      throw new Error('Please answer at least one question before generating');
    }

    // Get user config to determine if they use system credentials
    const userConfig = await ctx.runAction(
      api.userConfigActions.getUserConfig,
      {}
    );
    console.log(
      '[generatePhase] User config:',
      userConfig
        ? {
            provider: userConfig.provider,
            defaultModel: userConfig.defaultModel,
            useSystem: userConfig.useSystem,
          }
        : 'null'
    );

    // Get system credentials from database (decrypted, only accessible from Convex actions)
    let systemCredentialsMap: Record<string, SystemCredential>;
    try {
      systemCredentialsMap = await ctx.runAction(
        internalApi.internalActions.getAllDecryptedSystemCredentials,
        {}
      );
    } catch (error: any) {
      console.error(
        '[generatePhase] ERROR calling getAllDecryptedSystemCredentials:'
      );
      console.error('[generatePhase] Error message:', error?.message);
      console.error('[generatePhase] Error stack:', error?.stack);
      console.error(
        '[generatePhase] Error full:',
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      );
      systemCredentialsMap = {};
    }
    console.log(
      '[generatePhase] System credentials providers:',
      Object.keys(systemCredentialsMap || {})
    );

    // Get enabled models from database
    const enabledModelsFromDb = await ctx.runQuery(
      internalApi.llmModels.listEnabledModelsInternal
    );
    const enabledModels = selectEnabledModels(enabledModelsFromDb || []);
    console.log(
      '[generatePhase] Enabled models from DB:',
      enabledModels.map((m: Doc<'llmModels'>) => `${m.provider}:${m.modelId}`)
    );

    // Resolve credentials (user's own key or system key)
    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {}))
    );
    console.log(
      '[generatePhase] Resolved credentials:',
      credentials
        ? { provider: credentials.provider, modelId: credentials.modelId }
        : 'null'
    );

    // Get or select model
    // Priority: explicit modelId arg > user's configured model > first enabled model for provider > fallback
    let model: LlmModel;
    if (args.modelId) {
      console.log(
        '[generatePhase] Using explicit modelId from args:',
        args.modelId
      );
      model = getModelById(args.modelId) ?? getFallbackModel();
    } else if (credentials?.modelId && credentials.modelId !== '') {
      // User has configured a specific model
      console.log(
        '[generatePhase] Using user configured model:',
        credentials.modelId
      );
      model = getModelById(credentials.modelId) ?? getFallbackModel();
    } else if (credentials?.provider && enabledModels.length > 0) {
      // No specific model configured, use first enabled model for the provider
      console.log(
        '[generatePhase] Looking for enabled model for provider:',
        credentials.provider
      );
      const providerModel = enabledModels.find(
        (m: Doc<'llmModels'>) => m.provider === credentials.provider
      );
      if (providerModel) {
        console.log(
          '[generatePhase] Found provider model:',
          providerModel.modelId
        );
        model = {
          id: providerModel.modelId,
          provider: providerModel.provider as
            | "openai"
            | "openrouter"
            | "deepseek"
            | "anthropic"
            | "mistral"
            | "zai"
            | "minimax"
            | "other",
          contextTokens: providerModel.contextTokens,
          maxOutputTokens: providerModel.maxOutputTokens,
          defaultMax: providerModel.defaultMax,
        };
        // Update credentials with the selected model
        credentials.modelId = providerModel.modelId;
      } else {
        console.log(
          '[generatePhase] No model found for provider, using fallback'
        );
        model = getFallbackModel();
      }
    } else {
      console.log(
        '[generatePhase] No credentials or models, using fallback. credentials:',
        credentials,
        'enabledModels.length:',
        enabledModels.length
      );
      model = getFallbackModel();
    }
    console.log('[generatePhase] Final selected model:', model.id);

    // Validate model for artifact type
    const artifactType = getArtifactTypeForPhase(args.phaseId);

    const validation = validateModelForArtifact(model, artifactType);
    if (!validation.valid) {
      console.warn(`Model validation warning: ${validation.reason}`);
    }

    // Get section plan based on phase
    const sectionNames = getSectionPlan(artifactType, args.phaseId);
    const questionsText = answeredQuestions
      .map((q: Question) => `${q.text} ${q.answer ?? ''}`.trim())
      .join('\n');
    const estimatedTokens =
      estimateTokenCount(
        `${project.title}\n${project.description}\n${questionsText}`
      ) * 6;
    const sectionPlan = planSectionsForPhase({
      sectionNames,
      estimatedTokens,
      model,
    });

    // Build project context from questions
    const projectContext = {
      title: project.title,
      description: project.description,
      questions: answeredQuestions
        .map((q: Question) => `${q.text}: ${q.answer}`)
        .join('\n\n'),
    };

    // Get LLM client
    const llmClient = createLlmClient(credentials);
    const providerInfo = credentials
      ? `Using ${credentials.provider} provider`
      : 'No credentials configured';

    // Update phase status to 'generating' to provide UI feedback
    await ctx.runMutation(internalApi.internal.updatePhaseStatus, {
      projectId: args.projectId,
      phaseId: args.phaseId,
      status: 'generating',
    });

    try {
      // Generate sections using LLM
      const { sections: generatedSections, continuedSections } =
        await generateSectionsWithSelfCritique({
        ctx,
        projectId: args.projectId,
        projectContext,
        sectionPlan,
        model,
        questions: answeredQuestions,
        phaseId: args.phaseId,
        llmClient,
        providerInfo,
      });

      // Merge sections into final content
      const content = mergeSectionContent(generatedSections);
      const previewHtml = renderPreviewHtml(content);

      // Calculate section metadata
      const sections = generatedSections.map((section) => ({
        name: section.name,
        tokens: estimateTokenCount(section.content),
        model: model.id,
      }));

      // Create artifact
      const artifactId = await ctx.runMutation(
        internalApi.internal.createArtifact,
        {
          projectId: args.projectId,
          phaseId: args.phaseId,
          type: artifactType,
          title: `${args.phaseId.charAt(0).toUpperCase() + args.phaseId.slice(1)} - ${getPhaseTitle(args.phaseId)}`,
          content,
          previewHtml,
          sections,
        }
      );

      // Update phase status
      await ctx.runMutation(internalApi.internal.updatePhaseStatus, {
        projectId: args.projectId,
        phaseId: args.phaseId,
        status: 'ready',
      });

      return { artifactId, status: 'success', continuedSections };
    } catch (error) {
      await ctx.runMutation(internalApi.internal.updatePhaseStatus, {
        projectId: args.projectId,
        phaseId: args.phaseId,
        status: 'error',
      });
      throw error;
    }
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
}

export function planSectionsForPhase(params: {
  sectionNames: string[];
  estimatedTokens: number;
  model: LlmModel;
}): SectionPlan[] {
  const maxTokensPerSection = Math.max(
    256,
    Math.floor(params.model.maxOutputTokens * 0.8)
  );
  const expandedNames = expandSectionsForBudget({
    sectionNames: params.sectionNames,
    estimatedTokens: params.estimatedTokens,
    maxTokensPerSection,
  });
  return planSections(params.model, expandedNames, 0.8);
}

async function generateSectionsWithSelfCritique(
  params: GenerateSectionsParams
): Promise<{
  sections: Array<{ name: string; content: string }>;
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
  } = params;

  const sections: Array<{ name: string; content: string }> = [];
  let continuedSections = 0;
  const enableSelfCritique = false;

  for (let i = 0; i < sectionPlan.length; i++) {
    const section = sectionPlan[i];
    const previousSections = sections.slice(Math.max(0, i - 1), i);
    const sectionQuestions = extractRelevantQuestions(questions, section.name);

    // Generate section content
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
    });

    if (response.continued) {
      continuedSections += 1;
    }

    const normalizedContent = stripLeadingHeading(response.content);
    const improved = enableSelfCritique
      ? await selfCritiqueSection({
          content: normalizedContent,
          sectionName: section.name,
          projectContext,
          model,
          llmClient,
        })
      : normalizedContent;

    sections.push({
      name: section.name,
      content: stripLeadingHeading(improved),
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
}): Promise<{ content: string; continued: boolean }> {
  const { llmClient, model, maxTokens } = params;

  // Guard: No LLM client available
  if (!llmClient) {
    console.warn(
      '[generateSectionContent] No LLM client available, using fallback'
    );
    return {
      content: `## ${formatSectionName(params.sectionName)}\n\n_Content generation requires LLM configuration. Please configure your API keys in Settings._`,
      continued: false,
    };
  }

  // Build the prompt
  const systemPrompt = `You are an expert technical writer creating project documentation.
Generate the "${params.sectionName}" section for a ${params.phaseId} document.

Project: ${params.projectContext.title}
Description: ${params.projectContext.description}

${params.sectionInstructions}

Requirements:
- Use markdown formatting
- Be thorough and detailed
- Include specific, actionable content
- Reference the project context throughout`;

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
      continuationPrompt: (soFar) =>
        `${systemPrompt}\n\nContinue from the last sentence. Do not repeat content. Use markdown and continue exactly where you left off.\n\nCurrent content:\n${soFar}`,
      complete: (prompt) =>
        retryWithBackoff(
          () =>
            llmClient.complete(prompt, {
              model: model.id,
              maxTokens: Math.min(maxTokens, model.maxOutputTokens),
              temperature: 0.7,
            }),
          { retries: 3, minDelayMs: 500, maxDelayMs: 4000 }
        ),
    });

    const durationMs = Date.now() - startedAt;
    console.info(
      '[llm.telemetry]',
      buildTelemetry({
        provider: model.provider,
        model: model.id,
        durationMs,
        success: true,
      })
    );

    return {
      content: response.content,
      continued: response.continued,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    console.warn(
      '[llm.telemetry]',
      buildTelemetry({
        provider: model.provider,
        model: model.id,
        durationMs,
        success: false,
        error: error?.message ?? String(error),
      })
    );
    console.error(`[generateSectionContent] LLM call failed:`, error?.message);
    throw new Error(
      `Failed to generate ${params.sectionName}: ${error?.message}`
    );
  }
}


async function selfCritiqueSection(params: {
  content: string;
  sectionName: string;
  projectContext: { title: string; description: string };
  model: LlmModel;
  llmClient: ReturnType<typeof createLlmClient>;
}): Promise<string> {
  const { llmClient, model, content, sectionName, projectContext } = params;

  if (!llmClient) {
    return content; // Return original if no LLM available
  }

  const critiquePrompt = `Review this "${sectionName}" section for a project called "${projectContext.title}".

Content to review:
${content}

Analyze for:
1. Completeness - are all key points covered?
2. Clarity - is the content clear and actionable?
3. Consistency - does it align with the project description?
4. Quality - is it detailed enough for a handoff document?

If improvements are needed, provide the improved version.
If the content is sufficient, respond with "APPROVED" followed by the original content.`;

  try {
    const response = await retryWithBackoff(
      () =>
        llmClient.complete(critiquePrompt, {
          model: model.id,
          maxTokens: Math.min(model.maxOutputTokens, 4000),
          temperature: 0.3,
        }),
      { retries: 3, minDelayMs: 500, maxDelayMs: 4000 }
    );

    // Check if approved or extract improved content
    if (response.content.startsWith('APPROVED')) {
      return content;
    }
    return response.content;
  } catch (error) {
    console.warn(
      '[selfCritiqueSection] Critique failed, using original content'
    );
    return content;
  }
}

export function extractRelevantQuestions(
  questions: Question[],
  sectionName: string
): string[] {
  const keywords: Record<string, string[]> = {
    'executive-summary': ['goal', 'problem', 'success'],
    'problem-and-objectives': ['goal', 'problem', 'objective'],
    'features-and-requirements': ['feature', 'requirement', 'constraint'],
    'problem-statement': ['problem', 'challenge', 'pain'],
    'goals-and-objectives': ['goal', 'objective', 'success'],
    'user-personas': ['user', 'persona', 'audience'],
    requirements: ['requirement', 'feature', 'constraint'],
    'success-metrics': ['metric', 'kpi', 'success'],
    'architecture-overview': ['architecture', 'cloud', 'infrastructure'],
    'data-models-and-api': ['data', 'database', 'schema', 'api'],
    'deployment-and-security': ['deployment', 'security', 'auth'],
    'user-stories': ['user', 'persona', 'feature'],
    'technical-tasks': ['task', 'dependency', 'implementation'],
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
        relevantKeywords.some((kw) => q.text.toLowerCase().includes(kw))
    )
    .map((q) => `${q.text}: ${q.answer}`);
}

export function stripLeadingHeading(content: string): string {
  return content.replace(/^#{1,6}\s+.*\n+/, '').trim();
}

function getSectionInstructions(phaseId: string, sectionName: string): string {
  const instructions: Record<string, string> = {
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
    'requirements':
      'List all functional and non-functional requirements, organized by priority and category.',
    'success-metrics':
      'Define key performance indicators (KPIs), metrics for success, and how they will be measured and tracked.',

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
    brief: 'Project Brief',
    prd: 'Product Requirements Document',
    specs: 'Technical Specifications',
    stories: 'User Stories & Tasks',
    artifacts: 'Technical Artifacts',
    handoff: 'Project Handoff',
  };
  return titles[phaseId] || 'Document';
}
