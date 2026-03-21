'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import type { Id, Doc } from '../_generated/dataModel';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  resolveModelForCredentials,
  resolveCredentials,
  validateProviderModelMatch,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import type { LlmModel, ProviderCredentials } from '../../lib/llm/types';
import type { SystemCredential } from '../../lib/llm/registry';
import { createLlmClient } from '../../lib/llm/client-factory';
import { LLM_DEFAULTS } from '../../lib/llm/response-normalizer';
import { retryWithBackoff, sleep } from '../../lib/llm/retry';
import { rateLimiter } from '../rateLimiter';
import { logTelemetry } from '../../lib/llm/telemetry';
import { fetchModelDirectory } from '../../lib/llm/model-directory';

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

const ANSWER_FALLBACK_MESSAGE =
  'Answer temporarily unavailable due to provider rate limits. Please retry.';

export const generateAllQuestionAnswers = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{ taskId: Id<'generationTasks'> }> => {
    // Verify user owns project
    const project = await ctx.runQuery(internalApi.internal.getProjectInternal, {
      projectId: args.projectId,
    });
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    // Get phase with questions
    const phaseData = await ctx.runQuery(internalApi.internal.getPhaseInternal, {
      projectId: args.projectId,
      phaseId: args.phaseId,
    });
    if (!phaseData) throw new Error('Phase not found');

    const questions = phaseData.questions || [];
    if (questions.length === 0) {
      throw new Error('No questions found for this phase');
    }

    // Resolve credentials and model
    const userConfig = await ctx.runAction(
      internalApi.userConfigActions.getUserConfigInternal,
      {}
    );
    const systemCredentialsMap = await ctx.runAction(
      internalApi.internalActions.getAllDecryptedSystemCredentials,
      {}
    );
    const enabledModelsFromDb = await ctx.runQuery(
      internalApi.llmModels.listEnabledModelsInternal
    );
    const enabledModels = selectEnabledModels(enabledModelsFromDb || []);
    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {})),
      enabledModels
    );

    // Validate credentials are available
    if (!credentials) {
      throw new Error('No LLM credentials configured. Please configure your API keys in Settings.');
    }

    const model: LlmModel = resolveModelForCredentials(credentials, enabledModelsFromDb || [], enabledModels);

    // Validate provider-model match
    {
      const validation = validateProviderModelMatch(
        credentials.provider,
        model.id,
        enabledModelsFromDb || []
      );
      if (!validation.valid) {
        console.error(
          `[generateAllQuestionAnswers] Provider-model mismatch: ${validation.error}`
        );
        throw new Error(`Configuration error: ${validation.error}`);
      }
    }

    // Fetch provider API endpoint from models.dev
    let providerApiEndpoint: string | null = null;
    if (credentials.provider) {
      try {
        const providers = await fetchModelDirectory();
        const provider = providers.find(p => p.id === credentials.provider);
        providerApiEndpoint = provider?.api || null;
      } catch (err) {
        console.warn(`[generateAllQuestionAnswers] Failed to fetch provider API endpoint: ${err}`);
      }
    }

    // Build questions text from project context
    const questionsText = questions
      .filter((q: { answer?: string }) => q.answer)
      .map((q: { text: string; answer?: string }) => `${q.text}: ${q.answer}`)
      .join('\n');

    // Initialize the background task
    // Create credential reference (without apiKey) for secure storage
    const credentialRef = {
      provider: credentials.provider,
      modelId: credentials.modelId,
      source: (userConfig?.apiKey ? 'user' : 'system') as 'user' | 'system',
      zaiEndpointType: credentials.zaiEndpointType,
      zaiIsChina: credentials.zaiIsChina,
    };

    const taskId = await ctx.runMutation(
      internalApi.internal.initGenerationTask,
      {
        projectId: args.projectId,
        phaseId: args.phaseId,
        type: 'questions',
        totalSteps: questions.length,
        plan: questions.map((q) => ({ id: q.id, text: q.text })),
        metadata: {
          credentials: credentialRef,
          model,
          artifactType: 'questions',
          providerApiEndpoint: providerApiEndpoint ?? undefined,
          projectContext: {
            title: project.title,
            description: project.description,
            questions: questionsText,
          },
        },
      }
    );

    // Kick off the worker
    await ctx.scheduler.runAfter(
      0,
      internalApi.internalActions.generateQuestionsWorker,
      { taskId }
    );

    return { taskId };
  },
});

function buildBatchQuestionPrompt(params: {
  projectTitle: string;
  projectDescription: string;
  questionText: string;
  previousAnswers: string;
}): string {
  return `You are a senior software architect helping answer clarification questions for a software project specification.

Project Title: ${params.projectTitle}
Project Description: ${params.projectDescription}

${params.previousAnswers ? `Previously answered questions in this session:\n${params.previousAnswers}\n\n` : ''}Question: ${params.questionText}

Provide a clear, specific, and actionable answer. Include concrete details (e.g., specific technologies, patterns, metrics) rather than generic guidance. Maintain consistency with any previous answers above. Keep the answer concise (2-4 sentences).`;
}

async function generateAnswer(params: {
  prompt: string;
  model: LlmModel;
  llmClient: ReturnType<typeof createLlmClient>;
}): Promise<string> {
  if (!params.llmClient) {
    throw new Error(
      'No LLM client available. Please configure your API credentials in settings.'
    );
  }
  const llmClient = params.llmClient;

  try {
    const startedAt = Date.now();
    const response = await retryWithBackoff(
      () =>
        llmClient.complete(params.prompt, {
          model: params.model.id,
          maxTokens: Math.min(params.model.maxOutputTokens || 2000, 2000),
          temperature: 0.7,
        }),
      { retries: 3, minDelayMs: 500, maxDelayMs: 4000 }
    );
    const durationMs = Date.now() - startedAt;
    logTelemetry('info', {
      provider: params.model.provider,
      model: params.model.id,
      durationMs,
      success: true,
      tokens: {
        prompt: response.usage.promptTokens,
        completion: response.usage.completionTokens,
        total: response.usage.totalTokens,
      },
    });
    return response.content.trim();
  } catch (error: any) {
    logTelemetry('warn', {
      provider: params.model.provider,
      model: params.model.id,
      success: false,
      error: error?.message ?? 'Unknown error',
    });
    console.error('LLM API error:', error);
    throw new Error(
      `Failed to generate answer: ${error.message || 'Unknown error'}`
    );
  }
}

export async function getAnswerOrFallback(
  generator: () => Promise<string>
): Promise<string> {
  try {
    return await generator();
  } catch (error) {
    console.error(
      '[generateAllQuestionAnswers] Falling back after error:',
      error
    );
    return ANSWER_FALLBACK_MESSAGE;
  }
}
