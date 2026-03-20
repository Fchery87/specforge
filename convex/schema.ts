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
    skippedPhases: v.optional(v.array(v.string())),
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
        // AI-generated selectable suggestion options
        suggestions: v.optional(v.array(v.string())),
        selectedSuggestionIndex: v.optional(v.number()),
      }),
    ),
    // Staleness tracking for dependency graph
    isStale: v.optional(v.boolean()),
    staleReason: v.optional(v.string()),
    staleSince: v.optional(v.number()),
    upstreamChanges: v.optional(v.array(v.string())),
    // Drift detection report
    driftReport: v.optional(
      v.object({
        driftDetected: v.boolean(),
        driftSummary: v.string(),
        comparedAgainst: v.string(),
        checkedAt: v.number(),
        dismissed: v.optional(v.boolean()),
      }),
    ),
  }).index('by_project', ['projectId']),

  artifacts: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(),
    type: v.union(
      v.literal('brief'),
      v.literal('constitution'), // Markdown Phase artifact
      v.literal('hidden_constitution'), // Hidden JSON artifact for project standards
      v.literal('prd'),
      v.literal('domainModel'),
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
    // Constitution/Objective Layer fields
    isHidden: v.optional(v.boolean()), // Hide from user exports (e.g., constitution)
    lockedConstraints: v.optional(
      v.object({
        architecture: v.optional(v.string()),
        stateManagement: v.optional(v.string()),
        apiDesign: v.optional(v.string()),
        securityProtocols: v.optional(v.array(v.string())),
      }),
    ),
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
    // Provenance tracking for audit trail
    provenance: v.optional(
      v.object({
        constitutionHash: v.optional(v.string()),
        modelId: v.string(),
        modelProvider: v.string(),
        promptHash: v.string(),
        temperature: v.number(),
        generatedAt: v.number(),
        specforgeVersion: v.string(),
        parentArtifactIds: v.optional(v.array(v.id('artifacts'))),
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
    // Plan items can be either artifact sections or questions
    plan: v.array(
      v.union(
        // Artifact generation plan items
        v.object({
          name: v.string(),
          maxTokens: v.number(),
          sectionType: v.optional(v.string()),
        }),
        // Question answering plan items
        v.object({
          id: v.string(),
          text: v.string(),
        }),
      ),
    ),
    metadata: v.object({
      model: v.object({
        id: v.string(),
        provider: v.string(),
        contextTokens: v.number(),
        maxOutputTokens: v.number(),
        defaultMax: v.number(),
        enabled: v.optional(v.boolean()),
      }),
      credentials: v.object({
        provider: v.string(),
        apiKey: v.string(),
        modelId: v.string(),
        zaiEndpointType: v.optional(
          v.union(v.literal('paid'), v.literal('coding')),
        ),
        zaiIsChina: v.optional(v.boolean()),
      }),
      artifactType: v.string(),
      projectContext: v.object({
        title: v.string(),
        description: v.string(),
        questions: v.string(),
      }),
      providerApiEndpoint: v.optional(v.string()),
      sectionPreferences: v.optional(
        v.array(
          v.object({
            sectionId: v.string(),
            enabled: v.boolean(),
            customInstructions: v.optional(v.string()),
          }),
        ),
      ),
    }),
    error: v.optional(v.string()),
    updatedAt: v.number(),
    generatedSectionPlan: v.optional(v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        description: v.string(),
        estimatedTokens: v.number(),
        required: v.boolean(),
        sectionType: v.optional(v.union(
          v.literal('technical'),
          v.literal('implementation'),
          v.literal('planning'),
          v.literal('documentation'),
        )),
      })
    )),
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

  // Artifact versioning for history and rollback
  artifactVersions: defineTable({
    artifactId: v.id('artifacts'),
    version: v.number(),
    content: v.string(),
    contentHash: v.string(),
    previewHtml: v.string(),
    provenance: v.optional(
      v.object({
        constitutionHash: v.optional(v.string()),
        modelId: v.string(),
        modelProvider: v.string(),
        promptHash: v.string(),
        temperature: v.number(),
        generatedAt: v.number(),
        specforgeVersion: v.string(),
        parentArtifactIds: v.optional(v.array(v.id('artifacts'))),
      }),
    ),
    createdAt: v.number(),
    createdBy: v.union(v.literal('system'), v.literal('user')),
    changeReason: v.optional(v.string()),
  })
    .index('by_artifact', ['artifactId'])
    .index('by_artifact_version', ['artifactId', 'version']),

  // Models.dev cache for persistent storage of model directory
  // Enables fast lookups without hitting the external API
  modelDirectoryCache: defineTable({
    cacheKey: v.string(), // 'providers' or 'provider:{providerId}'
    data: v.any(), // Serialized provider/model data
    fetchedAt: v.number(),
    expiresAt: v.number(),
    version: v.number(), // Cache version for invalidation
  }).index('by_key', ['cacheKey']),

  // Structured tickets parsed from User Stories artifacts
  tickets: defineTable({
    projectId: v.id('projects'),
    phaseId: v.string(),
    artifactId: v.optional(v.id('artifacts')),
    title: v.string(),
    description: v.string(),
    acceptanceCriteria: v.array(v.string()),
    status: v.union(
      v.literal('todo'),
      v.literal('in_progress'),
      v.literal('done'),
    ),
    priority: v.union(
      v.literal('critical'),
      v.literal('high'),
      v.literal('medium'),
      v.literal('low'),
    ),
    estimatedEffort: v.optional(v.string()),
    order: v.number(),
    dependencies: v.optional(v.array(v.id('tickets'))),
    externalId: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_project', ['projectId'])
    .index('by_project_phase', ['projectId', 'phaseId']),
});
