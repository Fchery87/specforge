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

    const range = PHASE_QUESTION_RANGE[args.phaseId] || { min: 5, max: 8 };
    const baseQuestions = PHASE_QUESTIONS[args.phaseId] || PHASE_QUESTIONS["brief"];

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

    const credentials = resolveCredentials(
      userConfig,
      new Map(Object.entries(systemCredentialsMap || {}))
    );

    const enabledModelsFromDb = await ctx.runQuery(
      internalApi.llmModels.listEnabledModelsInternal
    );
    const enabledModels = selectEnabledModels(enabledModelsFromDb || []);

    let model: LlmModel;
    if (credentials?.modelId && credentials.modelId !== "") {
      model = getModelById(credentials.modelId) ?? getFallbackModel();
    } else if (credentials?.provider && enabledModels.length > 0) {
      const providerModel = enabledModels.find(
        (m: Doc<"llmModels">) => m.provider === credentials.provider
      );
      if (providerModel) {
        model = {
          id: providerModel.modelId,
          provider: providerModel.provider as
            | "openai"
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

    let aiQuestions: Array<{ text: string; required?: boolean }> = [];
    const llmClient = createLlmClient(credentials);
    if (llmClient) {
      try {
        const prompt = buildQuestionPrompt({
          title: project.title,
          description: project.description,
          phaseId: args.phaseId,
          range,
        });

        const response = await llmClient.complete(prompt, {
          model: model.id,
          maxTokens: LLM_DEFAULTS.QUESTION_ANSWER_TOKENS,
          temperature: 0.4,
        });
        aiQuestions = normalizeQuestions(
          parseQuestionsResponse(response.content),
          args.phaseId,
          range
        );
      } catch {
        aiQuestions = [];
      }
    }

    const normalizedQuestions =
      aiQuestions.length >= range.min ? aiQuestions : baseQuestions;

    const questions = normalizedQuestions.slice(0, range.max).map((q, idx) => ({
      id: `${args.phaseId}-q${idx + 1}`,
      text: q.text,
      answer: undefined as string | undefined,
      aiGenerated: normalizedQuestions === aiQuestions,
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
