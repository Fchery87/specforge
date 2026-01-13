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
import { rateLimiter } from '../rateLimiter';

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

export const generateAllQuestionAnswers = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{ answers: Array<{ questionId: string; answer: string }> }> => {
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
    if (questions.length === 0) {
      return { answers: [] };
    }

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
          provider: providerModel.provider as "openai" | "anthropic" | "mistral" | "zai" | "minimax" | "other",
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

    const llmClient = createLlmClient(credentials);

    // Generate answers progressively
    const answers: Array<{ questionId: string; answer: string }> = [];
    const generatedAnswers: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i] as Question;

      // Build context from previous answers in this batch
      const previousContext = generatedAnswers
        .map((ans, idx) => `${questions[idx].text}\nAnswer: ${ans}`)
        .join('\n\n');

      const prompt = buildBatchQuestionPrompt({
        projectTitle: project.title,
        projectDescription: project.description,
        questionText: question.text,
        previousAnswers: previousContext,
      });

      const answer = await generateAnswer({
        prompt,
        model,
        llmClient,
      });

      answers.push({ questionId: question.id, answer });
      generatedAnswers.push(answer);
    }

    return { answers };
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

  try {
    const response = await params.llmClient.complete(params.prompt, {
      model: params.model.id,
      maxTokens: Math.min(params.model.maxOutputTokens || 2000, 2000),
      temperature: 0.7,
    });
    return response.content.trim();
  } catch (error: any) {
    console.error('LLM API error:', error);
    throw new Error(
      `Failed to generate answer: ${error.message || 'Unknown error'}`
    );
  }
}
