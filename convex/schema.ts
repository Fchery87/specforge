import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  projects: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('complete'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    zipStorageId: v.optional(v.id('_storage')),
  }).index('by_user', ['userId']),

  phases: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('generating'),
      v.literal('ready'),
      v.literal('error'),
    ),
    questions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        answer: v.optional(v.string()),
        aiGenerated: v.boolean(),
        required: v.optional(v.boolean()),
      }),
    ),
  }).index('by_project', ['projectId']),

  // Artifact types supported by the system
  // Note: 'constitution' is a hidden artifact type used for internal consistency
  artifacts: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(),
    type: v.union(
      v.literal('brief'),
      v.literal('constitution'), // Hidden artifact for project standards
      v.literal('prd'),
      v.literal('spec'), // Legacy type for specs phase
      v.literal('techSpec'),
      v.literal('userStories'),
      v.literal('handoff'),
    ),
    title: v.string(),
    content: v.string(),
    previewHtml: v.string(),
    previewHtmlUpdatedAt: v.optional(v.number()),
    sections: v.array(
      v.object({ name: v.string(), tokens: v.number(), model: v.string() }),
    ),
    // v2 streaming fields (optional for backward compatibility)
    streamStatus: v.optional(
      v.union(
        v.literal('idle'),
        v.literal('streaming'),
        v.literal('paused'),
        v.literal('complete'),
        v.literal('cancelled'),
      ),
    ),
    currentSection: v.optional(v.string()),
    sectionsCompleted: v.optional(v.number()),
    sectionsTotal: v.optional(v.number()),
    tokensGenerated: v.optional(v.number()),
    // Constitution feature fields
    isHidden: v.optional(v.boolean()), // Hide from user exports (e.g., constitution)
    // Critique feature fields
    critique: v.optional(
      v.object({
        passes: v.boolean(),
        score: v.number(),
        violations: v.array(
          v.object({
            category: v.union(
              v.literal('accessibility'),
              v.literal('performance'),
              v.literal('security'),
              v.literal('architecture'),
              v.literal('completeness'),
            ),
            severity: v.union(
              v.literal('critical'),
              v.literal('warning'),
              v.literal('info'),
            ),
            issue: v.string(),
            suggestion: v.string(),
          }),
        ),
        refinedSection: v.optional(v.string()),
      }),
    ),
  })
    .index('by_project', ['projectId'])
    .index('by_phase', ['projectId', 'phaseId']),

  llmModels: defineTable({
    provider: v.string(),
    modelId: v.string(),
    contextTokens: v.number(),
    maxOutputTokens: v.number(),
    defaultMax: v.number(),
    enabled: v.boolean(),
  }).index('by_model', ['modelId']),

  // System-wide LLM provider credentials (for system credentials feature)
  systemCredentials: defineTable({
    provider: v.string(), // e.g., "openai", "anthropic", "zai", "minimax"
    apiKey: v.optional(v.bytes()), // Encrypted API key
    isEnabled: v.boolean(), // Whether this credential is active
    // Z.AI specific settings
    zaiEndpointType: v.optional(
      v.union(v.literal('paid'), v.literal('coding')),
    ),
    zaiIsChina: v.optional(v.boolean()),
    // Metadata
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_provider', ['provider']),

  userLlmConfigs: defineTable({
    userId: v.string(),
    provider: v.string(),
    apiKey: v.optional(v.bytes()),
    defaultModel: v.string(),
    useSystem: v.boolean(),
    systemKeyId: v.optional(v.string()),
    zaiEndpointType: v.optional(
      v.union(v.literal('paid'), v.literal('coding')),
    ),
    zaiIsChina: v.optional(v.boolean()),
  }).index('by_user', ['userId']),

  generationTasks: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(),
    type: v.union(v.literal('artifact'), v.literal('questions')),
    status: v.union(
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    currentStep: v.number(),
    totalSteps: v.number(),
    plan: v.any(), // Array of work items (section names or question IDs)
    metadata: v.any(), // Credentials, model, client-info etc.
    error: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_project_phase', ['projectId', 'phaseId']),

  // Section preferences for interactive planning feature
  // Stores user preferences for which sections to generate and custom instructions
  sectionPreferences: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(),
    sectionId: v.string(),
    enabled: v.boolean(),
    customInstructions: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_project_phase', ['projectId', 'phaseId'])
    .index('by_section', ['projectId', 'phaseId', 'sectionId']),
});
