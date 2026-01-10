"use node";

import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { api, internal as internalApi } from "../_generated/api";
import { v } from "convex/values";

const PHASE_QUESTIONS: Record<string, Array<{ text: string; required?: boolean }>> = {
  brief: [
    { text: "What is the primary goal of this project? What problem does it solve?", required: true },
    { text: "Who are the target users or audience for this product?", required: true },
    { text: "What are the key features or functionalities you want to include?", required: true },
    { text: "Are there any specific technical constraints or requirements? (e.g., integrations, compliance)" },
    { text: "What is your expected timeline or deadline for launch?" },
    { text: "Do you have any existing documentation, competitor analysis, or reference materials?" },
    { text: "What defines success for this project? Key metrics or outcomes?" },
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

export const generateQuestions = action({
  args: { projectId: v.id("projects"), phaseId: v.string() },
  handler: async (ctx: ActionCtx, args) => {
    const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
    if (!project) throw new Error("Project not found");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    const baseQuestions = PHASE_QUESTIONS[args.phaseId] || PHASE_QUESTIONS["brief"];

    const questions = baseQuestions.map((q, idx) => ({
      id: `${args.phaseId}-q${idx + 1}`,
      text: q.text,
      answer: undefined as string | undefined,
      aiGenerated: false,
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
