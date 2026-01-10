"use node";

import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { api, internal as internalApi } from "../_generated/api";
import { v } from "convex/values";
import { createZip } from "../../lib/zip";

export const generateProjectZip = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx: ActionCtx, args) => {
    const project = await ctx.runQuery(api.projects.getProject, { projectId: args.projectId });
    if (!project) throw new Error("Not found");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) throw new Error("Forbidden");

    const artifacts = await ctx.runQuery(api.projects.getPhaseArtifacts, { projectId: args.projectId });

    const entries = artifacts.map((a: any) => ({ path: `${a.phaseId}/${a.title}.md`, content: a.content }));
    entries.push({ path: "handoff/README.md", content: "# Project Export\n\nExported from SpecForge.\n" });

    const zipBytes = await createZip(entries);
    const uint8Array = new Uint8Array(zipBytes);
    const blob = new Blob([uint8Array], { type: "application/zip" });
    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internalApi.internal.saveZipToProject, {
      projectId: args.projectId,
      storageId,
    });

    return { storageId };
  },
});
