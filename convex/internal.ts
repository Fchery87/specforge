import { internalMutation, internalQuery } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import { getNextUpdatedAt } from './projects';
import { renderPreviewHtml } from '../lib/markdown-render';

/**
 * Maps phaseId to artifact type for database storage
 */
function mapPhaseToArtifactType(
  phaseId: string,
):
  | 'brief'
  | 'constitution'
  | 'prd'
  | 'domainModel'
  | 'spec'
  | 'techSpec'
  | 'userStories'
  | 'handoff' {
  switch (phaseId) {
    case 'constitution':
      return 'constitution';
    case 'brief':
      return 'brief';
    case 'prd':
      return 'prd';
    case 'domainModel':
      return 'domainModel';
    case 'specs':
      return 'techSpec';
    case 'stories':
      return 'userStories';
    case 'artifacts':
      return 'handoff';
    case 'handoff':
      return 'handoff';
    default:
      return 'handoff';
  }
}

export function filterArtifactsByPhase<
  T extends { projectId: string; phaseId: string; _id?: string },
>(artifacts: T[], projectId: string, phaseId: string): T[] {
  return artifacts.filter(
    (artifact) =>
      artifact.projectId === projectId && artifact.phaseId === phaseId,
  );
}

export const createArtifact = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    type: v.union(
      v.literal('brief'),
      v.literal('constitution'),
      v.literal('hidden_constitution'),
      v.literal('prd'),
      v.literal('domainModel'),
      v.literal('spec'),
      v.literal('techSpec'),
      v.literal('userStories'),
      v.literal('handoff'),
    ),
    title: v.string(),
    content: v.string(),
    previewHtml: v.string(),
    sections: v.array(
      v.object({ name: v.string(), tokens: v.number(), model: v.string() }),
    ),
    isHidden: v.optional(v.boolean()),
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
  },
  handler: async (ctx, args) => {
    const existingArtifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    const toDelete = filterArtifactsByPhase(
      existingArtifacts,
      args.projectId,
      args.phaseId,
    );

    // Snapshot existing artifact before deletion (versioning)
    for (const artifact of toDelete) {
      // Only snapshot if artifact has content (not empty/placeholder)
      if (artifact.content && artifact.content.length > 100) {
        const { computeContentHash } = await import('../lib/llm/provenance');

        // Get current max version
        const latestVersion = await ctx.db
          .query('artifactVersions')
          .withIndex('by_artifact', (q) => q.eq('artifactId', artifact._id))
          .order('desc')
          .first();

        const nextVersion = (latestVersion?.version ?? 0) + 1;

        await ctx.db.insert('artifactVersions', {
          artifactId: artifact._id,
          version: nextVersion,
          content: artifact.content,
          contentHash: computeContentHash(artifact.content),
          previewHtml: artifact.previewHtml,
          provenance: artifact.provenance,
          createdAt: Date.now(),
          createdBy: 'system',
          changeReason: 'Artifact regenerated',
        });

        // Cleanup old versions (keep last 10)
        const allVersions = await ctx.db
          .query('artifactVersions')
          .withIndex('by_artifact', (q) => q.eq('artifactId', artifact._id))
          .order('desc')
          .collect();

        const versionsToDelete = allVersions.slice(10);
        for (const version of versionsToDelete) {
          await ctx.db.delete(version._id);
        }
      }

      await ctx.db.delete(artifact._id);
    }
    return await ctx.db.insert('artifacts', {
      ...args,
      isHidden: args.isHidden ?? false,
    });
  },
});

export const saveZipToProject = internalMutation({
  args: { projectId: v.id('projects'), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, { zipStorageId: args.storageId });
  },
});

export const updatePhaseStatus = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('generating'),
      v.literal('ready'),
      v.literal('error'),
    ),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (phase) {
      await ctx.db.patch(phase._id, { status: args.status });
      const project = await ctx.db.get(args.projectId);
      if (project) {
        const now = Date.now();
        await ctx.db.patch(args.projectId, {
          updatedAt: getNextUpdatedAt(project.updatedAt, now),
        });
      }

      // When a phase becomes ready, propagate staleness to downstream phases
      if (args.status === 'ready') {
        const { getAffectedPhases } =
          await import('../lib/specification/dependency-graph');
        const affectedPhases = getAffectedPhases(args.phaseId);

        for (const phaseId of affectedPhases) {
          const downstreamPhase = await ctx.db
            .query('phases')
            .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
            .filter((q) => q.eq(q.field('phaseId'), phaseId))
            .first();

          if (downstreamPhase) {
            const upstreamChanges = downstreamPhase.upstreamChanges || [];
            if (!upstreamChanges.includes(args.phaseId)) {
              upstreamChanges.push(args.phaseId);
            }

            await ctx.db.patch(downstreamPhase._id, {
              isStale: true,
              staleReason: `Upstream phase "${args.phaseId}" was regenerated`,
              staleSince: Date.now(),
              upstreamChanges,
            });
          }
        }
      }

      // When a phase is regenerated, clear its staleness
      if (args.status === 'generating') {
        await ctx.db.patch(phase._id, {
          isStale: false,
          staleReason: undefined,
          staleSince: undefined,
          upstreamChanges: [],
        });
      }
    }
  },
});

export const getProjectInternal = internalQuery({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

export const getPhaseArtifactsInternal = internalQuery({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
  },
});

export const getArtifactByPhaseInternal = internalQuery({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('artifacts')
      .withIndex('by_phase', (q) =>
        q.eq('projectId', args.projectId).eq('phaseId', args.phaseId),
      )
      .first();
  },
});

/**
 * Gets an artifact by its type for a project.
 * Used to fetch hidden artifacts like constitution by type.
 */
export const getArtifactByTypeInternal = internalQuery({
  args: {
    projectId: v.id('projects'),
    type: v.union(
      v.literal('brief'),
      v.literal('constitution'),
      v.literal('hidden_constitution'),
      v.literal('prd'),
      v.literal('domainModel'),
      v.literal('spec'),
      v.literal('techSpec'),
      v.literal('userStories'),
      v.literal('handoff'),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('type'), args.type))
      .first();
  },
});

export const updatePhaseQuestionsInternal = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    questions: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        answer: v.optional(v.string()),
        aiGenerated: v.boolean(),
        required: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    const project = await ctx.db.get(args.projectId);
    const now = Date.now();
    if (!phase) {
      await ctx.db.insert('phases', {
        projectId: args.projectId,
        phaseId: args.phaseId,
        status: 'ready',
        questions: args.questions,
      });
    } else {
      await ctx.db.patch(phase._id, { questions: args.questions });
    }

    if (project) {
      await ctx.db.patch(args.projectId, {
        updatedAt: getNextUpdatedAt(project.updatedAt, now),
      });
    }
  },
});

export const initGenerationTask = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    type: v.union(v.literal('artifact'), v.literal('questions')),
    totalSteps: v.number(),
    plan: v.array(
      v.union(
        v.object({
          name: v.string(),
          maxTokens: v.number(),
          sectionType: v.optional(v.string()),
        }),
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
  },
  handler: async (ctx, args) => {
    // Delete any existing tasks for this phase
    const existing = await ctx.db
      .query('generationTasks')
      .withIndex('by_project_phase', (q) =>
        q.eq('projectId', args.projectId).eq('phaseId', args.phaseId),
      )
      .collect();
    for (const t of existing) await ctx.db.delete(t._id);

    return await ctx.db.insert('generationTasks', {
      ...args,
      status: 'in_progress',
      currentStep: 0,
      updatedAt: Date.now(),
    });
  },
});

export const updateGenerationTask = internalMutation({
  args: {
    taskId: v.id('generationTasks'),
    currentStep: v.number(),
    status: v.union(
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { taskId, ...updates } = args;
    await ctx.db.patch(taskId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const getGenerationTask = internalQuery({
  args: { taskId: v.id('generationTasks') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.taskId);
  },
});

export const appendSectionToArtifactInternal = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    section: v.object({
      name: v.string(),
      content: v.string(),
      previewHtml: v.string(),
      tokens: v.number(),
      model: v.string(),
    }),
    isFirst: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get existing artifact for this phase
    const existing = await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    const project = await ctx.db.get(args.projectId);
    const now = Date.now();
    if (args.isFirst || !existing) {
      // Create new or overwrite
      if (existing) await ctx.db.delete(existing._id);

      await ctx.db.insert('artifacts', {
        projectId: args.projectId,
        phaseId: args.phaseId,
        type: mapPhaseToArtifactType(args.phaseId),
        title: `${args.phaseId.charAt(0).toUpperCase() + args.phaseId.slice(1)} Document`,
        content: args.section.content,
        previewHtml: args.section.previewHtml,
        sections: [
          {
            name: args.section.name,
            tokens: args.section.tokens,
            model: args.section.model,
          },
        ],
      });
    } else {
      // Append content
      const newContent = `${existing.content}\n\n${args.section.content}`;
      const newPreview = `${existing.previewHtml}${args.section.previewHtml}`;
      const newSections = [
        ...existing.sections,
        {
          name: args.section.name,
          tokens: args.section.tokens,
          model: args.section.model,
        },
      ];

      await ctx.db.patch(existing._id, {
        content: newContent,
        previewHtml: newPreview,
        sections: newSections,
      });
    }

    if (project) {
      await ctx.db.patch(args.projectId, {
        updatedAt: getNextUpdatedAt(project.updatedAt, now),
      });
    }
  },
});

export const appendSectionMetadataToArtifactInternal = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    section: v.object({
      name: v.string(),
      tokens: v.number(),
      model: v.string(),
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
              criterion: v.optional(v.string()),
              issue: v.string(),
              suggestion: v.string(),
            }),
          ),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query('artifacts')
      .withIndex('by_phase', (q) =>
        q.eq('projectId', args.projectId).eq('phaseId', args.phaseId),
      )
      .first();
    if (!artifact) return;

    const sections = artifact.sections ?? [];
    const existingIdx = sections.findIndex((s) => s.name === args.section.name);
    const nextSections =
      existingIdx >= 0
        ? sections.map((s, i) => (i === existingIdx ? args.section : s))
        : [...sections, args.section];

    await ctx.db.patch(artifact._id, { sections: nextSections });
  },
});

export const appendPartialContentToArtifactInternal = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    deltaContent: v.string(),
    tokensGeneratedDelta: v.number(),
    recomputePreview: v.optional(v.boolean()),
    currentSection: v.optional(v.string()),
    sectionsCompleted: v.optional(v.number()),
    sectionsTotal: v.optional(v.number()),
    streamStatus: v.optional(
      v.union(
        v.literal('idle'),
        v.literal('streaming'),
        v.literal('paused'),
        v.literal('complete'),
        v.literal('cancelled'),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('artifacts')
      .withIndex('by_phase', (q) =>
        q.eq('projectId', args.projectId).eq('phaseId', args.phaseId),
      )
      .first();

    const now = Date.now();
    const project = await ctx.db.get(args.projectId);

    const nextContent = `${existing?.content ?? ''}${args.deltaContent}`;
    const nextTokensGenerated =
      (existing?.tokensGenerated ?? 0) + args.tokensGeneratedDelta;

    const shouldRecomputePreview =
      args.recomputePreview === true ||
      !existing?.previewHtml ||
      !existing?.previewHtmlUpdatedAt ||
      now - existing.previewHtmlUpdatedAt > 2000;

    if (!existing) {
      await ctx.db.insert('artifacts', {
        projectId: args.projectId,
        phaseId: args.phaseId,
        type: mapPhaseToArtifactType(args.phaseId),
        title: `${args.phaseId.charAt(0).toUpperCase() + args.phaseId.slice(1)} Document`,
        content: nextContent,
        previewHtml: renderPreviewHtml(nextContent),
        sections: [],
        sectionsTotal: args.sectionsTotal,
        sectionsCompleted: args.sectionsCompleted,
        tokensGenerated: nextTokensGenerated,
        streamStatus: args.streamStatus,
        currentSection: args.currentSection,
        previewHtmlUpdatedAt: now,
      });
    } else {
      // Update existing artifact with streaming progress
      await ctx.db.patch(existing._id, {
        content: nextContent,
        ...(shouldRecomputePreview && {
          previewHtml: renderPreviewHtml(nextContent),
          previewHtmlUpdatedAt: now,
        }),
        streamStatus: args.streamStatus ?? existing.streamStatus,
        currentSection: args.currentSection ?? existing.currentSection,
        sectionsCompleted: args.sectionsCompleted ?? existing.sectionsCompleted,
        sectionsTotal: args.sectionsTotal ?? existing.sectionsTotal,
        tokensGenerated: nextTokensGenerated,
      });
    }

    if (project) {
      await ctx.db.patch(args.projectId, {
        updatedAt: getNextUpdatedAt(project.updatedAt, now),
      });
    }
  },
});

/**
 * Replaces an artifact's content with a sanitized version.
 * Called after streaming finishes to clean up any CoT reasoning that
 * leaked through individual delta chunks during streaming.
 */
export const sanitizeArtifactContentInternal = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    sanitizedContent: v.string(),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query('artifacts')
      .withIndex('by_phase', (q) =>
        q.eq('projectId', args.projectId).eq('phaseId', args.phaseId),
      )
      .first();
    if (!artifact) return;

    // Only patch if content actually changed (avoid unnecessary writes)
    if (artifact.content !== args.sanitizedContent) {
      await ctx.db.patch(artifact._id, {
        content: args.sanitizedContent,
        previewHtml: renderPreviewHtml(args.sanitizedContent),
        previewHtmlUpdatedAt: Date.now(),
      });
    }
  },
});

export const setArtifactStreamStatusInternal = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    streamStatus: v.union(
      v.literal('idle'),
      v.literal('streaming'),
      v.literal('paused'),
      v.literal('complete'),
      v.literal('cancelled'),
    ),
    currentSection: v.optional(v.string()),
    sectionsCompleted: v.optional(v.number()),
    sectionsTotal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query('artifacts')
      .withIndex('by_phase', (q) =>
        q.eq('projectId', args.projectId).eq('phaseId', args.phaseId),
      )
      .first();
    if (!artifact) return;

    await ctx.db.patch(artifact._id, {
      streamStatus: args.streamStatus,
      currentSection: args.currentSection,
      sectionsCompleted: args.sectionsCompleted,
      sectionsTotal: args.sectionsTotal,
    });
  },
});

export const getPhaseInternal = internalQuery({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    const artifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .collect();

    return { ...(phase ?? { questions: [] }), artifacts };
  },
});

export const saveAnswerInternal = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    questionId: v.string(),
    answer: v.string(),
    aiGenerated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase) throw new Error('Phase not found');

    const project = await ctx.db.get(args.projectId);
    const now = Date.now();
    const updatedQuestions = (phase.questions || []).map((q: any) =>
      q.id === args.questionId
        ? {
            ...q,
            answer: args.answer,
            ...(args.aiGenerated !== undefined
              ? { aiGenerated: args.aiGenerated }
              : {}),
          }
        : q,
    );

    await ctx.db.patch(phase._id, { questions: updatedQuestions });
    if (project) {
      await ctx.db.patch(args.projectId, {
        updatedAt: getNextUpdatedAt(project.updatedAt, now),
      });
    }
  },
});

// ============================================================================
// ARTIFACT VERSIONING
// ============================================================================

export const snapshotArtifactVersion = internalMutation({
  args: {
    artifactId: v.id('artifacts'),
    changeReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) return null;

    // Get current max version
    const latestVersion = await ctx.db
      .query('artifactVersions')
      .withIndex('by_artifact', (q) => q.eq('artifactId', args.artifactId))
      .order('desc')
      .first();

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Import computeContentHash from provenance utilities
    const { computeContentHash } = await import('../lib/llm/provenance');

    await ctx.db.insert('artifactVersions', {
      artifactId: args.artifactId,
      version: nextVersion,
      content: artifact.content,
      contentHash: computeContentHash(artifact.content),
      previewHtml: artifact.previewHtml,
      provenance: artifact.provenance,
      createdAt: Date.now(),
      createdBy: 'system',
      changeReason: args.changeReason,
    });

    return nextVersion;
  },
});

export const getArtifactVersions = internalQuery({
  args: { artifactId: v.id('artifacts') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('artifactVersions')
      .withIndex('by_artifact', (q) => q.eq('artifactId', args.artifactId))
      .order('desc')
      .collect();
  },
});

export const getArtifactVersion = internalQuery({
  args: {
    artifactId: v.id('artifacts'),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('artifactVersions')
      .withIndex('by_artifact_version', (q) =>
        q.eq('artifactId', args.artifactId).eq('version', args.version),
      )
      .first();
  },
});

// Retention policy: Keep only the last N versions per artifact
export const cleanupOldArtifactVersions = internalMutation({
  args: {
    artifactId: v.id('artifacts'),
    keepLast: v.number(),
  },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query('artifactVersions')
      .withIndex('by_artifact', (q) => q.eq('artifactId', args.artifactId))
      .order('desc')
      .collect();

    // Delete versions beyond the keep limit
    const toDelete = versions.slice(args.keepLast);
    for (const version of toDelete) {
      await ctx.db.delete(version._id);
    }

    return {
      deleted: toDelete.length,
      kept: Math.min(versions.length, args.keepLast),
    };
  },
});

// ============================================================================
// PHASE DEPENDENCY & STALENESS
// ============================================================================

export const markPhaseStale = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    upstreamPhase: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase) return;

    const now = Date.now();
    const upstreamChanges = phase.upstreamChanges || [];

    // Add upstream phase to changes list if not already present
    if (!upstreamChanges.includes(args.upstreamPhase)) {
      upstreamChanges.push(args.upstreamPhase);
    }

    await ctx.db.patch(phase._id, {
      isStale: true,
      staleReason:
        args.reason || `Upstream phase "${args.upstreamPhase}" was regenerated`,
      staleSince: now,
      upstreamChanges,
    });
  },
});

export const clearPhaseStaleness = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase) return;

    await ctx.db.patch(phase._id, {
      isStale: false,
      staleReason: undefined,
      staleSince: undefined,
      upstreamChanges: [],
    });
  },
});

export const propagateStaleness = internalMutation({
  args: {
    projectId: v.id('projects'),
    changedPhase: v.string(),
  },
  handler: async (ctx, args) => {
    // Import dependency graph functions
    const { getAffectedPhases } =
      await import('../lib/specification/dependency-graph');

    const affectedPhases = getAffectedPhases(args.changedPhase);

    for (const phaseId of affectedPhases) {
      const downstreamPhase = await ctx.db
        .query('phases')
        .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
        .filter((q) => q.eq(q.field('phaseId'), phaseId))
        .first();

      if (downstreamPhase) {
        const upstreamChanges = downstreamPhase.upstreamChanges || [];

        // Add upstream phase to changes list if not already present
        if (!upstreamChanges.includes(args.changedPhase)) {
          upstreamChanges.push(args.changedPhase);
        }

        await ctx.db.patch(downstreamPhase._id, {
          isStale: true,
          staleReason: `Upstream phase "${args.changedPhase}" was regenerated`,
          staleSince: Date.now(),
          upstreamChanges,
        });
      }
    }

    return { affectedCount: affectedPhases.length, affectedPhases };
  },
});

export const getPhaseWithStaleness = internalQuery({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase) return null;

    const artifacts = await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .collect();

    return {
      ...phase,
      artifacts,
      isStale: phase.isStale || false,
      staleReason: phase.staleReason,
      staleSince: phase.staleSince,
      upstreamChanges: phase.upstreamChanges || [],
    };
  },
});

// ============================================================================
// DRIFT DETECTION
// ============================================================================

export const saveDriftReport = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    driftDetected: v.boolean(),
    driftSummary: v.string(),
    comparedAgainst: v.string(),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase) return;

    await ctx.db.patch(phase._id, {
      driftReport: {
        driftDetected: args.driftDetected,
        driftSummary: args.driftSummary,
        comparedAgainst: args.comparedAgainst,
        checkedAt: Date.now(),
        dismissed: false,
      },
    });
  },
});

export const dismissDriftReport = internalMutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase || !phase.driftReport) return;

    await ctx.db.patch(phase._id, {
      driftReport: {
        ...phase.driftReport,
        dismissed: true,
      },
    });
  },
});

export const getDriftReport = internalQuery({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    return phase?.driftReport || null;
  },
});

// ============================================================================
// CRON JOB SUPPORT - Internal queries and mutations for scheduled tasks
// ============================================================================

/**
 * Get all artifacts for cleanup processing
 */
export const getAllArtifacts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('artifacts').collect();
  },
});

/**
 * Delete a specific artifact version
 */
export const deleteArtifactVersion = internalMutation({
  args: {
    versionId: v.id('artifactVersions'),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.versionId);
  },
});

/**
 * Set a cache entry in modelDirectoryCache (insert or update)
 */
export const setModelDirectoryCache = internalMutation({
  args: {
    cacheKey: v.string(),
    data: v.any(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('modelDirectoryCache')
      .withIndex('by_key', (q) => q.eq('cacheKey', args.cacheKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.data,
        fetchedAt: Date.now(),
        expiresAt: args.expiresAt,
        version: (existing.version || 0) + 1,
      });
      return existing._id;
    } else {
      return await ctx.db.insert('modelDirectoryCache', {
        cacheKey: args.cacheKey,
        data: args.data,
        fetchedAt: Date.now(),
        expiresAt: args.expiresAt,
        version: 1,
      });
    }
  },
});
