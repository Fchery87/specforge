/**
 * Section Preferences API
 *
 * Provides mutations and queries for managing user section preferences
 * during interactive section planning (Phase 4 P2).
 */

import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Saves or updates section preferences for a phase
 */
export const saveSectionPreferences = mutation({
  args: {
    projectId: v.id("projects"),
    phaseId: v.string(),
    preferences: v.array(
      v.object({
        sectionId: v.string(),
        enabled: v.boolean(),
        customInstructions: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) {
      throw new Error("Forbidden");
    }

    const now = Date.now();

    // Delete existing preferences for this phase
    const existingPrefs = await ctx.db
      .query("sectionPreferences")
      .withIndex("by_project_phase", (q) =>
        q.eq("projectId", args.projectId).eq("phaseId", args.phaseId)
      )
      .collect();

    for (const pref of existingPrefs) {
      await ctx.db.delete(pref._id);
    }

    // Insert new preferences
    for (const pref of args.preferences) {
      await ctx.db.insert("sectionPreferences", {
        projectId: args.projectId,
        phaseId: args.phaseId,
        sectionId: pref.sectionId,
        enabled: pref.enabled,
        customInstructions: pref.customInstructions,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Gets section preferences for a phase
 */
export const getSectionPreferences = query({
  args: {
    projectId: v.id("projects"),
    phaseId: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) {
      throw new Error("Forbidden");
    }

    return await ctx.db
      .query("sectionPreferences")
      .withIndex("by_project_phase", (q) =>
        q.eq("projectId", args.projectId).eq("phaseId", args.phaseId)
      )
      .collect();
  },
});

/**
 * Gets a single section preference
 */
export const getSectionPreference = query({
  args: {
    projectId: v.id("projects"),
    phaseId: v.string(),
    sectionId: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) {
      throw new Error("Forbidden");
    }

    return await ctx.db
      .query("sectionPreferences")
      .withIndex("by_section", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("phaseId", args.phaseId)
          .eq("sectionId", args.sectionId)
      )
      .first();
  },
});

/**
 * Deletes all section preferences for a phase
 */
export const deleteSectionPreferences = mutation({
  args: {
    projectId: v.id("projects"),
    phaseId: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject) {
      throw new Error("Forbidden");
    }

    const preferences = await ctx.db
      .query("sectionPreferences")
      .withIndex("by_project_phase", (q) =>
        q.eq("projectId", args.projectId).eq("phaseId", args.phaseId)
      )
      .collect();

    for (const pref of preferences) {
      await ctx.db.delete(pref._id);
    }

    return { success: true };
  },
});
