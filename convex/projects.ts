import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { v } from 'convex/values';
import { canAccessProject } from '../lib/authz';
import { normalizeProjectInput } from '../lib/project-input';

const DEFAULT_PHASES = [
  'constitution',
  'brief',
  'prd',
  'domainModel',
  'specs',
  'stories',
  'artifacts',
  'handoff',
];

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
    case 'handoff':
      return 'handoff';
    case 'artifacts':
      return 'handoff'; // Artifacts phase produces handoff artifacts
    default:
      return 'handoff';
  }
}

export const createProject = mutation({
  args: { title: v.string(), description: v.string() },
  handler: async (ctx: MutationCtx, args) => {
    const normalized = normalizeProjectInput({
      title: args.title,
      description: args.description,
    });
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');
    const userId = identity.subject;

    const now = Date.now();
    const projectId = await ctx.db.insert('projects', {
      userId,
      title: normalized.title,
      description: normalized.description,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    for (const phaseId of DEFAULT_PHASES) {
      await ctx.db.insert('phases', {
        projectId,
        phaseId,
        status: 'pending',
        questions: [],
      });
    }

    return projectId;
  },
});

export const getProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');
    return project;
  },
});

export const getProjects = query({
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query('projects')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect();
  },
});

export const getProjectPhases = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !canAccessProject(project.userId, identity.subject)) {
      throw new Error('Forbidden');
    }

    return await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
  },
});

export const getPhase = query({
  args: { projectId: v.id('projects'), phaseId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

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

export const getPhaseArtifacts = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !canAccessProject(project.userId, identity.subject)) {
      throw new Error('Forbidden');
    }

    return await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
  },
});

export const getGenerationTask = query({
  args: { taskId: v.id('generationTasks') },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const project = await ctx.db.get(task.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    return task;
  },
});

export const getProjectZipUrl = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx: QueryCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !canAccessProject(project.userId, identity.subject)) {
      throw new Error('Forbidden');
    }

    if (!project.zipStorageId) return null;

    return await ctx.storage.getUrl(project.zipStorageId);
  },
});

export const saveAnswer = mutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    questionId: v.string(),
    answer: v.string(),
    aiGenerated: v.optional(v.boolean()),
  },
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error('Project not found');
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase) throw new Error('Phase not found');

    const now = Date.now();
    const updatedQuestions = applyAnswerUpdate(
      phase.questions,
      args.questionId,
      args.answer,
      args.aiGenerated,
    );

    await ctx.db.patch(phase._id, { questions: updatedQuestions });
    await ctx.db.patch(args.projectId, {
      updatedAt: getNextUpdatedAt(project.updatedAt, now),
    });
  },
});

export function applyAnswerUpdate<
  T extends { id: string; aiGenerated?: boolean; answer?: string },
>(
  questions: T[],
  questionId: string,
  answer: string,
  aiGenerated?: boolean,
): T[] {
  return questions.map((q) =>
    q.id === questionId
      ? {
          ...q,
          answer,
          ...(aiGenerated !== undefined ? { aiGenerated } : {}),
        }
      : q,
  );
}

export function getNextUpdatedAt(current: number, now: number): number {
  return now > current ? now : current;
}

// Exported handler for testing
export async function deleteProjectHandler(
  ctx: MutationCtx,
  args: { projectId: any },
) {
  const project = await ctx.db.get(args.projectId);
  if (!project) throw new Error('Project not found');

  const identity = await ctx.auth.getUserIdentity();
  if (!identity || (project as Doc<'projects'>).userId !== identity.subject) {
    throw new Error('Forbidden');
  }

  // Cascade delete phases
  const phases = await ctx.db
    .query('phases')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const phase of phases) {
    await ctx.db.delete(phase._id);
  }

  // Cascade delete artifacts
  const artifacts = await ctx.db
    .query('artifacts')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const artifact of artifacts) {
    await ctx.db.delete(artifact._id);
  }

  // Cascade delete artifact versions (for each artifact)
  for (const artifact of artifacts) {
    const versions = await ctx.db
      .query('artifactVersions')
      .withIndex('by_artifact', (q) => q.eq('artifactId', artifact._id))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }
  }

  // Cascade delete generation tasks
  const tasks = await ctx.db
    .query('generationTasks')
    .withIndex('by_project_phase', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const task of tasks) {
    await ctx.db.delete(task._id);
  }

  // Cascade delete section preferences
  const prefs = await ctx.db
    .query('sectionPreferences')
    .withIndex('by_project_phase', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const pref of prefs) {
    await ctx.db.delete(pref._id);
  }

  // Cascade delete project codebase
  const codebases = await ctx.db
    .query('projectCodebase')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const cb of codebases) {
    await ctx.db.delete(cb._id);
  }

  // Cascade delete verification results
  const verifications = await ctx.db
    .query('verificationResults')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const vr of verifications) {
    await ctx.db.delete(vr._id);
  }

  // Cascade delete tickets
  const tickets = await ctx.db
    .query('tickets')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const ticket of tickets) {
    await ctx.db.delete(ticket._id);
  }

  // Delete the project
  await ctx.db.delete(args.projectId);
}

export const deleteProject = mutation({
  args: { projectId: v.id('projects') },
  handler: deleteProjectHandler,
});

export const updatePhaseQuestions = mutation({
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
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error('Project not found');
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

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

    await ctx.db.patch(args.projectId, {
      updatedAt: getNextUpdatedAt(project.updatedAt, now),
    });
  },
});

export const toggleSkipPhase = mutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    skip: v.boolean(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) throw new Error('Forbidden');

    const current = project.skippedPhases ?? [];
    const updated = args.skip
      ? [...new Set([...current, args.phaseId])]
      : current.filter((p: string) => p !== args.phaseId);

    await ctx.db.patch(args.projectId, { skippedPhases: updated });
  },
});

export const appendSectionToArtifact = mutation({
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
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error('Project not found');
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    // Get existing artifact for this phase
    const existing = await ctx.db
      .query('artifacts')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

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

    await ctx.db.patch(args.projectId, {
      updatedAt: getNextUpdatedAt(project.updatedAt, now),
    });
  },
});
