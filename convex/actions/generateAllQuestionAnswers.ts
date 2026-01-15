'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import type { Id, Doc } from '../_generated/dataModel';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  getModelById,
  getFallbackModel,
  resolveCredentials,
  validateProviderModelMatch,
  getFirstEnabledModelForProvider,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import type { LlmModel, ProviderCredentials } from '../../lib/llm/types';
import type { SystemCredential } from '../../lib/llm/registry';
import { createLlmClient } from '../../lib/llm/client-factory';
import { LLM_DEFAULTS } from '../../lib/llm/response-normalizer';
import { retryWithBackoff, sleep } from '../../lib/llm/retry';
import { rateLimiter } from '../rateLimiter';
import { logTelemetry } from '../../lib/llm/telemetry';

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
    const project = await ctx.runQuery(api.projects.getProject, {
      projectId: args.projectId,
    });
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    // Get phase with questions
    const phaseData = await ctx.runQuery(api.projects.getPhase, {
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
      api.userConfigActions.getUserConfig,
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

    let model: LlmModel;
    if (credentials?.modelId) {
      model = getModelById(credentials.modelId) ?? getFallbackModel();
    } else if (credentials?.provider) {
      // Fallback to first enabled model for provider
      const modelId = getFirstEnabledModelForProvider(
        credentials.provider,
        enabledModels
      );
      model = getModelById(modelId) ?? getFallbackModel();
    } else {
      model = getFallbackModel();
    }

    // Validate provider-model match
    if (credentials) {
      const validation = validateProviderModelMatch(
        credentials.provider,
        model.id
      );
      if (!validation.valid) {
        console.error(
          `[generateAllQuestionAnswers] Provider-model mismatch: ${validation.error}`
        );
        throw new Error(`Configuration error: ${validation.error}`);
      }
    }

    // Initialize the background task
    const taskId = await ctx.runMutation(
      internalApi.internal.initGenerationTask,
      {
        projectId: args.projectId,
        phaseId: args.phaseId,
        type: 'questions',
        totalSteps: questions.length,
        plan: questions.map((q) => ({ id: q.id, text: q.text })),
        metadata: {
          credentials,
          model,
          projectContext: {
            title: project.title,
            description: project.description,
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
  return `You are helping answer questions for a software project.

Project Title: ${params.projectTitle}
Project Description: ${params.projectDescription}

${params.previousAnswers ? `Previous answers in this batch:\n${params.previousAnswers}\n\n` : ''}

Question: ${params.questionText}

Provide a clear, concise answer based on the project context and maintain consistency with previous answers. Be specific and actionable.`;
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
