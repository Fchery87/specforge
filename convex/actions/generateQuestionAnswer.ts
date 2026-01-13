'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  getModelById,
  getFallbackModel,
  resolveCredentials,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import type { LlmModel, ProviderCredentials } from '../../lib/llm/types';
import type { SystemCredential } from '../../lib/llm/registry';
import { createLlmClient } from '../../lib/llm/client-factory';
import { LLM_DEFAULTS } from '../../lib/llm/response-normalizer';
import { retryWithBackoff } from '../../lib/llm/retry';
import { rateLimiter } from '../rateLimiter';
import { buildTelemetry } from '../../lib/llm/telemetry';

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

export const generateQuestionAnswer = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    questionId: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{ suggestedAnswer: string }> => {
    // Verify user owns project
    const project = await ctx.runQuery(api.projects.getProject, {
      projectId: args.projectId,
    });
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    const userId = identity.tokenIdentifier;

    // Rate limiting - per-user limit
    await rateLimiter.limit(ctx, "generateQuestionAnswer", {
      key: userId,
      throws: true,
    });

    // Get phase with questions
    const phaseData = await ctx.runQuery(api.projects.getPhase, {
      projectId: args.projectId,
      phaseId: args.phaseId,
    });
    if (!phaseData) throw new Error('Phase not found');

    const questions = phaseData.questions || [];
    const targetQuestion = questions.find(
      (q: Question) => q.id === args.questionId
    );
    if (!targetQuestion) throw new Error('Question not found');

    // Get previously answered questions
    const targetIndex = questions.findIndex(
      (q: Question) => q.id === args.questionId
    );
    const previousQuestions = questions
      .slice(0, targetIndex)
      .filter((q: Question) => q.answer)
      .map((q: Question) => `${q.text}\nAnswer: ${q.answer}`)
      .join('\n\n');

    // Resolve credentials
    const userConfig = await ctx.runAction(
      api.userConfigActions.getUserConfig,
      {}
    );

    let systemCredentialsMap: Record<string, SystemCredential>;
    try {
      systemCredentialsMap = await ctx.runAction(
        internalApi.internalActions.getAllDecryptedSystemCredentials,
        {}
      );
    } catch {
      systemCredentialsMap = {};
    }

    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {}))
    );

    // Get model
    const enabledModelsFromDb = await ctx.runQuery(
      internalApi.llmModels.listEnabledModelsInternal
    );
    const enabledModels = selectEnabledModels(enabledModelsFromDb || []);

    let model: LlmModel;
    if (credentials?.modelId && credentials.modelId !== '') {
      model = getModelById(credentials.modelId) ?? getFallbackModel();
    } else if (credentials?.provider && enabledModels.length > 0) {
      const providerModel = enabledModels.find(
        (m: Doc<'llmModels'>) => m.provider === credentials.provider
      );
      if (providerModel) {
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
        credentials.modelId = providerModel.modelId;
      } else {
        model = getFallbackModel();
      }
    } else {
      model = getFallbackModel();
    }

    // Build prompt
    const prompt = buildQuestionPrompt({
      projectTitle: project.title,
      projectDescription: project.description,
      questionText: targetQuestion.text,
      previousQuestions,
    });

    // Generate answer using LLM
    const llmClient = createLlmClient(credentials);
    const suggestedAnswer = await generateAnswer({
      prompt,
      model,
      llmClient,
    });

    return { suggestedAnswer };
  },
});

function buildQuestionPrompt(params: {
  projectTitle: string;
  projectDescription: string;
  questionText: string;
  previousQuestions: string;
}): string {
  return `You are helping answer questions for a software project.

Project Title: ${params.projectTitle}
Project Description: ${params.projectDescription}

${params.previousQuestions ? `Previous answers:\n${params.previousQuestions}\n\n` : ''}

Question: ${params.questionText}

Provide a clear, concise answer based on the project context. Be specific and actionable.`;
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
    console.info(
      '[llm.telemetry]',
      buildTelemetry({
        provider: params.model.provider,
        model: params.model.id,
        durationMs,
        success: true,
        tokens: {
          prompt: response.usage.promptTokens,
          completion: response.usage.completionTokens,
          total: response.usage.totalTokens,
        },
      })
    );

    return response.content.trim();
  } catch (error: any) {
    console.warn(
      '[llm.telemetry]',
      buildTelemetry({
        provider: params.model.provider,
        model: params.model.id,
        success: false,
        error: error?.message ?? 'Unknown error',
      })
    );
    console.error('LLM API error:', error);
    throw new Error(
      `Failed to generate answer: ${error.message || 'Unknown error'}`
    );
  }
}
