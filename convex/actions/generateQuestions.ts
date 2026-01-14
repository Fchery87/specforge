"use node";

import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { api, internal as internalApi } from "../_generated/api";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { selectEnabledModels } from "../../lib/llm/model-select";
import {
  getModelById,
  getFallbackModel,
  resolveCredentials,
} from "../../lib/llm/registry";
import type { LlmModel } from "../../lib/llm/types";
import type { SystemCredential } from "../../lib/llm/registry";
import { createLlmClient } from "../../lib/llm/client-factory";
import { LLM_DEFAULTS } from "../../lib/llm/response-normalizer";
import { retryWithBackoff } from "../../lib/llm/retry";
import { rateLimiter } from "../rateLimiter";
import { logTelemetry } from "../../lib/llm/telemetry";

const PHASE_QUESTIONS: Record<
  string,
  Array<{ text: string; required?: boolean }>
> = {
  brief: [
    { text: "What is the primary goal of this project? What problem does it solve?", required: true },
    { text: "Who are the target users or audience for this product?", required: true },
    { text: "What are the key features or functionalities you want to include?", required: true },
    { text: "Are there any specific technical constraints or requirements? (e.g., integrations, compliance)" },
    { text: "What is your expected timeline or deadline for launch?" },
    { text: "Do you have any existing documentation, competitor analysis, or reference materials?" },
    { text: "What defines success for this project? Key metrics or outcomes?" },
  ],
  prd: [
    { text: "What is the primary goal of this product and who is it for?", required: true },
    { text: "What problem does this solve, and why now?" },
    { text: "What are the key user journeys or workflows?" },
    { text: "What are the must-have vs nice-to-have requirements?" },
    { text: "How will success be measured (KPIs/metrics)?" },
  ],
  specs: [
    { text: "What architectural style do you prefer? (e.g., REST, GraphQL, gRPC)" },
    { text: "Do you have preferred cloud providers or infrastructure requirements?" },
    { text: "What are the expected scale and performance requirements?" },
    { text: "Do you need real-time features, and if so, what kind? (e.g., websockets, server-sent events)" },
    { text: "What authentication and authorization requirements exist?" },
    { text: "Are there specific data models or database preferences?" },
  ],
  stories: [
    { text: "What is your preferred sprint or iteration length?" },
    { text: "Are there features that must be in the MVP versus nice-to-have?" },
    { text: "Do you have any user research or personas to share?" },
    { text: "What edge cases or error states should be handled?" },
  ],
  artifacts: [
    { text: "What additional artifacts do you need beyond the standard deliverables?" },
    { text: "Do you need API documentation, database schemas, or deployment guides?" },
  ],
  handoff: [
    { text: "Who are the developers or team members receiving this handoff?" },
    { text: "Are there specific coding standards or conventions to follow?" },
    { text: "What environment setup or credentials need to be documented?" },
  ],
};

const PHASE_QUESTION_RANGE: Record<string, { min: number; max: number }> = {
  brief: { min: 5, max: 8 },
  prd: { min: 5, max: 8 },
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
}): string {
  return `Generate ${params.range.min}-${params.range.max} specific, high-value questions for the "${params.phaseId}" phase.\n\n` +
    `Project Title: ${params.title}\n` +
    `Project Description: ${params.description}\n\n` +
    `Return JSON only in this shape:\n` +
    `{\"questions\":[{\"text\":\"...\",\"required\":true}]}`;
}

export function normalizeQuestions(
  questions: Array<{ text: string; required?: boolean }>,
  phaseId: string,
  range: { min: number; max: number }
): Array<{ text: string; required?: boolean }> {
  const filtered = questions.filter((q) => q.text?.trim().length);
  return filtered.slice(0, range.max);
}

export function selectQuestions(
  aiQuestions: Array<{ text: string; required?: boolean }>,
  baseQuestions: Array<{ text: string; required?: boolean }>,
  range: { min: number; max: number }
): { questions: Array<{ text: string; required?: boolean }>; aiGenerated: boolean } {
  if (aiQuestions.length >= range.min) {
    return { questions: aiQuestions.slice(0, range.max), aiGenerated: true };
  }
  return { questions: baseQuestions.slice(0, range.max), aiGenerated: false };
}

function parseQuestionsResponse(
  raw: string
): Array<{ text: string; required?: boolean }> {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((text) =>
        typeof text === "string" ? { text } : text
      );
    }
    if (parsed && Array.isArray(parsed.questions)) {
      return parsed.questions;
    }
  } catch {
    // Try to recover JSON object from a wrapped response
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
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
  args: { projectId: v.id("projects"), phaseId: v.string() },
  handler: async (ctx: ActionCtx, args) => {
    const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
    if (!project) throw new Error("Project not found");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    const userId = identity.tokenIdentifier;
    await rateLimiter.limit(ctx, "generateQuestions", { key: userId, throws: true });

    const range = PHASE_QUESTION_RANGE[args.phaseId] || { min: 5, max: 8 };
    const baseQuestions = PHASE_QUESTIONS[args.phaseId] || PHASE_QUESTIONS["brief"];

    let aiQuestions: Array<{ text: string; required?: boolean }> = [];
    let aiGenerated = false;
    let credentials: ReturnType<typeof resolveCredentials> = null;
    try {
      // Resolve credentials for AI question generation
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

      credentials = resolveCredentials(
        userConfig,
        new Map(Object.entries(systemCredentialsMap || {}))
      );

      const enabledModelsFromDb = await ctx.runQuery(
        internalApi.llmModels.listEnabledModelsInternal
      );
      const enabledModels = selectEnabledModels(enabledModelsFromDb || []);

      let model: LlmModel;
      const provider = credentials?.provider;
      if (credentials?.modelId && credentials.modelId !== "") {
        model = getModelById(credentials.modelId) ?? getFallbackModel();
      } else if (provider && enabledModels.length > 0) {
        const providerModel = enabledModels.find(
          (m: Doc<"llmModels">) => m.provider === provider
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
          if (credentials) {
            credentials.modelId = providerModel.modelId;
          }
        } else {
          model = getFallbackModel();
        }
      } else {
        model = getFallbackModel();
      }

      const llmClient = createLlmClient(credentials);
      if (llmClient) {
        const prompt = buildQuestionPrompt({
          title: project.title,
          description: project.description,
          phaseId: args.phaseId,
          range,
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
          { retries: 3, minDelayMs: 500, maxDelayMs: 4000 }
        );
        const durationMs = Date.now() - startedAt;
        logTelemetry("info", {
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
          range
        );
      }
    } catch {
      logTelemetry("warn", {
        provider: credentials?.provider ?? "unknown",
        model: "unknown",
        success: false,
        error: "generateQuestions failed",
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
    }));

    await ctx.runMutation(api.projects.updatePhaseQuestions, {
      projectId: args.projectId,
      phaseId: args.phaseId,
      questions,
    });

    return { questions };
  },
});
