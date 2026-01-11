'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  getModelById,
  getFallbackModel,
  resolveCredentials,
} from '../../lib/llm/registry';
import { createOpenAIClient } from '../../lib/llm/providers/openai';
import { createAnthropicClient } from '../../lib/llm/providers/anthropic';
import { createZAIClient } from '../../lib/llm/providers/zai';
import { createMinimaxClient } from '../../lib/llm/providers/minimax';
import type { ProviderCredentials } from '../../lib/llm/types';

interface Question {
  id: string;
  text: string;
  answer?: string;
  aiGenerated: boolean;
  required?: boolean;
}

function getLlmClient(credentials: ProviderCredentials | null) {
  if (!credentials) return null;

  switch (credentials.provider) {
    case 'openai':
      return createOpenAIClient(credentials.apiKey);
    case 'anthropic':
      return createAnthropicClient(credentials.apiKey);
    case 'zai':
      return createZAIClient(
        credentials.apiKey,
        credentials.zaiEndpointType ?? 'paid',
        credentials.zaiIsChina ?? false
      );
    case 'minimax':
      return createMinimaxClient(credentials.apiKey);
    default:
      return null;
  }
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

    // Get phase with questions
    const phaseData = await ctx.runQuery(api.projects.getPhase, {
      projectId: args.projectId,
      phaseId: args.phaseId,
    });
    if (!phaseData) throw new Error('Phase not found');

    const questions = phaseData.questions || [];
    const targetQuestion = questions.find((q: Question) => q.id === args.questionId);
    if (!targetQuestion) throw new Error('Question not found');

    // Get previously answered questions
    const targetIndex = questions.findIndex((q: Question) => q.id === args.questionId);
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

    let systemCredentialsMap: any;
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
    const enabledModelsFromDb = await ctx.runQuery(api.admin.listAllModels);
    const enabledModels = (enabledModelsFromDb || []).filter(
      (m: any) => m.enabled
    );

    let model: any;
    if (credentials?.modelId && credentials.modelId !== '') {
      model = getModelById(credentials.modelId) ?? getFallbackModel();
    } else if (credentials?.provider && enabledModels.length > 0) {
      const providerModel = enabledModels.find(
        (m: any) => m.provider === credentials.provider
      );
      if (providerModel) {
        model = {
          id: providerModel.modelId,
          provider: providerModel.provider,
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
    const llmClient = getLlmClient(credentials);
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
  model: any;
  llmClient: ReturnType<typeof getLlmClient>;
}): Promise<string> {
  if (!params.llmClient) {
    throw new Error('No LLM client available. Please configure your API credentials in settings.');
  }

  try {
    const response = await params.llmClient.complete(params.prompt, {
      model: params.model.id,
      maxTokens: 500,
      temperature: 0.7,
    });
    return response.content.trim();
  } catch (error: any) {
    console.error('LLM API error:', error);
    throw new Error(`Failed to generate answer: ${error.message || 'Unknown error'}`);
  }
}
