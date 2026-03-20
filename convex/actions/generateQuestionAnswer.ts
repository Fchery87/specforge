'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import {
  resolveModelForCredentials,
  resolveCredentials,
} from '../../lib/llm/registry';
import { selectEnabledModels } from '../../lib/llm/model-select';
import type { LlmModel } from '../../lib/llm/types';
import type { SystemCredential } from '../../lib/llm/registry';
import { createLlmClient } from '../../lib/llm/client-factory';
import { LLM_DEFAULTS } from '../../lib/llm/response-normalizer';
import { retryWithBackoff } from '../../lib/llm/retry';
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

export const generateQuestionAnswer = action({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    questionId: v.string(),
  },
  handler: async (
    ctx: ActionCtx,
    args
  ): Promise<{ suggestedAnswer: string; suggestions: string[] }> => {
    // Verify user owns project
    const project = await ctx.runQuery(internalApi.internal.getProjectInternal, {
      projectId: args.projectId,
    });
    if (!project) throw new Error('Project not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    const userId = identity.tokenIdentifier;

    // Rate limiting - per-user limit
    await rateLimiter.limit(ctx, 'generateQuestionAnswer', {
      key: userId,
      throws: true,
    });

    // Get phase with questions
    const phaseData = await ctx.runQuery(internalApi.internal.getPhaseInternal, {
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
      internalApi.userConfigActions.getUserConfigInternal,
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

    // Get model
    const enabledModelsFromDb = await ctx.runQuery(
      internalApi.llmModels.listEnabledModelsInternal
    );
    const enabledModels = selectEnabledModels(enabledModelsFromDb || []);

    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {})),
      enabledModels
    );

    const model: LlmModel = resolveModelForCredentials(credentials, enabledModelsFromDb || [], enabledModels);

    // Fetch provider API endpoint from models.dev
    let providerApiEndpoint: string | null = null;
    if (credentials?.provider) {
      try {
        const providers = await fetchModelDirectory();
        const provider = providers.find(p => p.id === credentials.provider);
        providerApiEndpoint = provider?.api || null;
      } catch (err) {
        console.warn(`[generateQuestionAnswer] Failed to fetch provider API endpoint: ${err}`);
      }
    }

    // Build prompt
    const prompt = buildQuestionPrompt({
      projectTitle: project.title,
      projectDescription: project.description,
      questionText: targetQuestion.text,
      previousQuestions,
    });

    // Generate answer using LLM with dynamic API endpoint
    const llmClient = createLlmClient(credentials, providerApiEndpoint);
    const { suggestedAnswer, suggestions } = await generateAnswer({
      prompt,
      model,
      llmClient,
    });

    return { suggestedAnswer, suggestions };
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

${params.previousQuestions ? `Previous answers:\n${params.previousQuestions}\n\n` : ''}Question: ${params.questionText}

Respond ONLY with valid JSON in this exact shape:
{
  "suggestedAnswer": "<full answer, clear and specific>",
  "suggestions": ["<option 1, 5-15 words>", "<option 2>", "<option 3>", "<option 4>"]
}
Provide 3-5 concise selectable options in "suggestions". No explanation outside the JSON.`;
}

export function parseSuggestionsResponse(raw: string): { suggestedAnswer: string; suggestions: string[] } {
  const fallback = { suggestedAnswer: raw.trim(), suggestions: [] };
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return fallback;
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const suggestedAnswer = typeof parsed.suggestedAnswer === 'string' ? parsed.suggestedAnswer.trim() : '';
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 5)
      : [];
    if (!suggestedAnswer) return fallback;
    return { suggestedAnswer, suggestions };
  } catch {
    return fallback;
  }
}

async function generateAnswer(params: {
  prompt: string;
  model: LlmModel;
  llmClient: ReturnType<typeof createLlmClient>;
}): Promise<{ suggestedAnswer: string; suggestions: string[] }> {
  if (!params.llmClient) {
    throw new Error(
      'No LLM client available. Please configure your API credentials in settings.'
    );
  }

  try {
    const startedAt = Date.now();
    const response = await retryWithBackoff(
      () =>
        params.llmClient!.complete(params.prompt, {
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

    return parseSuggestionsResponse(response.content);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logTelemetry('warn', {
      provider: params.model.provider,
      model: params.model.id,
      success: false,
      error: message,
    });
    console.error('LLM API error:', error);
    throw new Error(`Failed to generate answer: ${message}`);
  }
}
