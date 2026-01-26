import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

export async function cancelArtifactStreamingHandler(
  ctx: Pick<MutationCtx, "db" | "auth">,
  args: { projectId: any; phaseId: string }
): Promise<void> {
  const project = await ctx.db.get(args.projectId);
  if (!project || !("userId" in project)) throw new Error("Not found");

  const identity = await ctx.auth.getUserIdentity();
  if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

  const artifact = await ctx.db
    .query("artifacts")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .filter((q) => q.eq(q.field("phaseId"), args.phaseId))
    .first();

  if (!artifact) return;

  await ctx.db.patch(artifact._id, { streamStatus: "cancelled" });
}

export async function getArtifactByPhaseHandler(
  ctx: Pick<QueryCtx, "db" | "auth">,
  args: { projectId: any; phaseId: string }
) {
  const project = await ctx.db.get(args.projectId);
  if (!project || !("userId" in project)) return null;

  const identity = await ctx.auth.getUserIdentity();
  if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

  return await ctx.db
    .query("artifacts")
    .withIndex("by_phase", (q) => q.eq("projectId", args.projectId).eq("phaseId", args.phaseId))
    .first();
}

export const upsertArtifact = mutation({
  args: {
    projectId: v.id("projects"),
    phaseId: v.string(),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    previewHtml: v.string(),
    sections: v.array(v.object({ name: v.string(), tokens: v.number(), model: v.string() })),
  },
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Not found");
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");
    return await ctx.db.insert("artifacts", { ...args });
  },
});

export const cancelArtifactStreaming = mutation({
  args: { projectId: v.id("projects"), phaseId: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    await cancelArtifactStreamingHandler(ctx, args);
  },
});

export const getArtifactByPhase = query({
  args: { projectId: v.id("projects"), phaseId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    return await getArtifactByPhaseHandler(ctx, args);
  },
});

export const getArtifact = query({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx: QueryCtx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) return null;

    const project = await ctx.db.get(artifact.projectId);
    if (!project) return null;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    return artifact;
  },
});

export const updateArtifact = mutation({
  args: {
    artifactId: v.id("artifacts"),
    content: v.optional(v.string()),
    previewHtml: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) throw new Error("Artifact not found");

    const project = await ctx.db.get(artifact.projectId);
    if (!project) throw new Error("Project not found");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.patch(args.artifactId, {
      ...(args.content !== undefined && { content: args.content }),
      ...(args.previewHtml !== undefined && { previewHtml: args.previewHtml }),
    });
  },
});

export const deleteArtifact = mutation({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx: MutationCtx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) throw new Error("Artifact not found");

    const project = await ctx.db.get(artifact.projectId);
    if (!project) throw new Error("Project not found");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    await ctx.db.delete(args.artifactId);
  },
});

export const getArtifactsByPhase = query({
  args: { projectId: v.id("projects"), phaseId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    return await ctx.db
      .query("artifacts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("phaseId"), args.phaseId))
      .collect();
  },
});
