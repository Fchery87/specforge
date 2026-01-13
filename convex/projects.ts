import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { canAccessProject } from "../lib/authz";
import { normalizeProjectInput } from "../lib/project-input";

const DEFAULT_PHASES = ["brief", "prd", "specs", "stories", "artifacts", "handoff"];

export const createProject = mutation({
  args: { title: v.string(), description: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const normalized = normalizeProjectInput({
      title: args.title,
      description: args.description,
    });
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      userId,
      title: normalized.title,
      description: normalized.description,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    for (const phaseId of DEFAULT_PHASES) {
      await ctx.db.insert("phases", { projectId, phaseId, status: "pending", questions: [] });
    }

    return projectId;
  },
});

export const getProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");
    return project;
  },
});

export const getProjects = query({
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const getProjectPhases = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !canAccessProject(project.userId, identity.subject)) {
      throw new Error("Forbidden");
    }

    return await ctx.db
      .query("phases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getPhase = query({
  args: { projectId: v.id("projects"), phaseId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    const phase = await ctx.db
      .query("phases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("phaseId"), args.phaseId))
      .first();

    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("phaseId"), args.phaseId))
      .collect();

    return { ...(phase ?? { questions: [] }), artifacts };
  },
});

export const getPhaseArtifacts = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !canAccessProject(project.userId, identity.subject)) {
      throw new Error("Forbidden");
    }

    return await ctx.db
      .query("artifacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getProjectZipUrl = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !canAccessProject(project.userId, identity.subject)) {
      throw new Error("Forbidden");
    }

    if (!project.zipStorageId) return null;

    return await ctx.storage.getUrl(project.zipStorageId);
  },
});

export const saveAnswer = mutation({
  args: {
    projectId: v.id("projects"),
    phaseId: v.string(),
    questionId: v.string(),
    answer: v.string(),
    aiGenerated: v.optional(v.boolean()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    const phase = await ctx.db
      .query("phases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("phaseId"), args.phaseId))
      .first();

    if (!phase) throw new Error("Phase not found");

    const updatedQuestions = applyAnswerUpdate(
      phase.questions,
      args.questionId,
      args.answer,
      args.aiGenerated
    );

    await ctx.db.patch(phase._id, { questions: updatedQuestions });
  },
});

export function applyAnswerUpdate<T extends { id: string; aiGenerated?: boolean; answer?: string }>(
  questions: T[],
  questionId: string,
  answer: string,
  aiGenerated?: boolean
): T[] {
  return questions.map((q) =>
    q.id === questionId
      ? {
          ...q,
          answer,
          ...(aiGenerated !== undefined ? { aiGenerated } : {}),
        }
      : q
  );
}

export const updatePhaseQuestions = mutation({
  args: {
    projectId: v.id("projects"),
    phaseId: v.string(),
    questions: v.array(v.object({
      id: v.string(),
      text: v.string(),
      answer: v.optional(v.string()),
      aiGenerated: v.boolean(),
      required: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    const phase = await ctx.db
      .query("phases")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("phaseId"), args.phaseId))
      .first();

    if (!phase) {
      await ctx.db.insert("phases", {
        projectId: args.projectId,
        phaseId: args.phaseId,
        status: "ready",
        questions: args.questions,
      });
    } else {
      await ctx.db.patch(phase._id, { questions: args.questions });
    }
  },
});
