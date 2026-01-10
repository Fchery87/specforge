import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("complete")),
    createdAt: v.number(),
    updatedAt: v.number(),
    zipStorageId: v.optional(v.id("_storage")),
  }).index("by_user", ["userId"]),

  phases: defineTable({
    projectId: v.id("projects"),
    phaseId: v.string(),
    status: v.union(v.literal("pending"), v.literal("generating"), v.literal("ready"), v.literal("error")),
    questions: v.array(v.object({
      id: v.string(),
      text: v.string(),
      answer: v.optional(v.string()),
      aiGenerated: v.boolean(),
      required: v.optional(v.boolean()),
    })),
  }).index("by_project", ["projectId"]),

  artifacts: defineTable({
    projectId: v.id("projects"),
    phaseId: v.string(),
    type: v.string(),
    title: v.string(),
    content: v.string(),
    previewHtml: v.string(),
    sections: v.array(v.object({ name: v.string(), tokens: v.number(), model: v.string() })),
    zipFileUrl: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  llmModels: defineTable({
    provider: v.string(),
    modelId: v.string(),
    contextTokens: v.number(),
    maxOutputTokens: v.number(),
    defaultMax: v.number(),
    enabled: v.boolean(),
  }).index("by_model", ["modelId"]),

  userLlmConfigs: defineTable({
    userId: v.string(),
    provider: v.string(),
    apiKey: v.optional(v.bytes()),
    defaultModel: v.string(),
    useSystem: v.boolean(),
  }).index("by_user", ["userId"]),
});
