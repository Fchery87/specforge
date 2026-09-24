import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { canAccessProject } from '../lib/authz';
import { normalizeProjectInput } from '../lib/project-input';
import { mapPhaseToArtifactType } from './lib/phase_utils';
import { captureEvidenceSource } from './lib/evidence';

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

type ConstitutionTemplateSnapshot = Pick<
  Doc<'constitutionTemplates'>,
  'name' | 'constitutionContent' | 'lockedConstraints'
>;

export function buildConstitutionTemplateSnapshot(
  template: ConstitutionTemplateSnapshot,
): ConstitutionTemplateSnapshot {
  return {
    name: template.name,
    constitutionContent: template.constitutionContent,
    lockedConstraints: template.lockedConstraints,
  };
}

// mapPhaseToArtifactType is now imported from './lib/phase-utils'

export const createProject = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    constitutionTemplateId: v.optional(v.id('constitutionTemplates')),
  },
  handler: async (ctx: MutationCtx, args) => {
    const normalized = normalizeProjectInput({
      title: args.title,
      description: args.description,
    });
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');
    const userId = identity.subject;

    let constitutionTemplate: ConstitutionTemplateSnapshot | undefined;
    if (args.constitutionTemplateId) {
      const template = await ctx.db.get(args.constitutionTemplateId);
      if (!template) throw new Error('Constitution template not found');
      if (template.userId !== userId) throw new Error('Forbidden');
      constitutionTemplate = buildConstitutionTemplateSnapshot(template);
      await ctx.db.patch(template._id, {
        usageCount: (template.usageCount ?? 0) + 1,
      });
    }

    const now = Date.now();
    const projectId = await ctx.db.insert('projects', {
      userId,
      title: normalized.title,
      description: normalized.description,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      constitutionTemplate,
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
    if (args.answer.trim()) {
      await captureEvidenceSource(ctx, {
        projectId: args.projectId,
        sourceKey: `answer:${args.phaseId}:${args.questionId}`,
        kind: 'answer',
        locator: `${args.phaseId}/${args.questionId}`,
        revisionLabel: `Answer in ${args.phaseId}`,
        content: args.answer,
        capturedBy: identity.subject,
        origin: args.aiGenerated ? 'assistant' : 'user',
      });
    }
    await ctx.db.patch(args.projectId, {
      updatedAt: getNextUpdatedAt(project.updatedAt, now),
    });
  },
});

export function mergeGrillAnswersIntoQuestions<
  T extends {
    id: string;
    text: string;
    answer?: string;
    aiGenerated: boolean;
    required?: boolean;
    suggestions?: string[];
    selectedSuggestionIndex?: number;
  },
>(
  currentQuestions: T[],
  answers: Array<{
    questionId: string;
    questionText: string;
    answer: string;
    options?: string[];
  }>,
): T[] {
  const questionMap = new Map(currentQuestions.map((q) => [q.id, { ...q }]));

  for (const item of answers) {
    const existing = questionMap.get(item.questionId);
    if (existing) {
      existing.answer = item.answer;
      existing.aiGenerated = false;
    } else {
      questionMap.set(item.questionId, {
        id: item.questionId,
        text: item.questionText,
        answer: item.answer,
        aiGenerated: false,
        required: false,
        suggestions: item.options,
      } as T);
    }
  }

  return Array.from(questionMap.values());
}

export function computeUpdatedGrillSession(
  existingSession:
    | {
        totalQuestionsAsked: number;
        currentRound: number;
        isComplete: boolean;
        rounds: Array<{
          roundNumber: number;
          questions: Array<{
            id: string;
            text: string;
            recommendedAnswer: string;
            options?: string[];
            category?: string;
            userAnswer?: string;
            acceptedRecommendation?: boolean;
          }>;
        }>;
      }
    | undefined,
  answers: Array<{
    questionId: string;
    questionText: string;
    answer: string;
    recommendedAnswer: string;
    acceptedRecommendation?: boolean;
    options?: string[];
    category?: string;
    round: number;
  }>,
) {
  const session = existingSession || {
    totalQuestionsAsked: 0,
    currentRound: 0,
    isComplete: false,
    rounds: [],
  };

  const roundNum = answers.length > 0 ? answers[0].round : session.currentRound + 1;
  const newRound = {
    roundNumber: roundNum,
    questions: answers.map((a) => ({
      id: a.questionId,
      text: a.questionText,
      recommendedAnswer: a.recommendedAnswer,
      options: a.options,
      category: a.category,
      userAnswer: a.answer,
      acceptedRecommendation: a.acceptedRecommendation,
    })),
  };

  const updatedRounds = [
    ...session.rounds.filter((r) => r.roundNumber !== roundNum),
    newRound,
  ];
  const totalAsked = updatedRounds.reduce((acc, r) => acc + r.questions.length, 0);

  return {
    totalQuestionsAsked: totalAsked,
    currentRound: Math.max(session.currentRound, roundNum),
    isComplete: totalAsked >= 10,
    rounds: updatedRounds,
  };
}

export const saveGrillAnswers = mutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
    answers: v.array(
      v.object({
        questionId: v.string(),
        questionText: v.string(),
        answer: v.string(),
        recommendedAnswer: v.string(),
        acceptedRecommendation: v.optional(v.boolean()),
        options: v.optional(v.array(v.string())),
        category: v.optional(v.string()),
        round: v.number(),
      }),
    ),
  },
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error('Project not found');
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || (project as Doc<'projects'>).userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase) throw new Error('Phase not found');

    const updatedQuestions = mergeGrillAnswersIntoQuestions(
      phase.questions || [],
      args.answers,
    );

    const updatedSession = computeUpdatedGrillSession(
      phase.grillSession,
      args.answers,
    );

    const now = Date.now();
    await ctx.db.patch(phase._id, {
      questions: updatedQuestions,
      grillSession: updatedSession,
    });
    for (const answer of args.answers) {
      if (!answer.answer.trim()) continue;
      await captureEvidenceSource(ctx, {
        projectId: args.projectId,
        sourceKey: `answer:${args.phaseId}:${answer.questionId}`,
        kind: 'answer',
        locator: `${args.phaseId}/${answer.questionId}`,
        revisionLabel: `Grilling answer in ${args.phaseId}`,
        content: answer.answer,
        capturedBy: identity.subject,
        origin: 'user',
      });
    }

    await ctx.db.patch(args.projectId, {
      updatedAt: getNextUpdatedAt(project.updatedAt, now),
    });

    return updatedSession;
  },
});

export const resetGrillSession = mutation({
  args: {
    projectId: v.id('projects'),
    phaseId: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error('Project not found');
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || (project as Doc<'projects'>).userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .filter((q) => q.eq(q.field('phaseId'), args.phaseId))
      .first();

    if (!phase) throw new Error('Phase not found');

    const nonGrillQuestions = (phase.questions || []).filter(
      (q) => !q.id.includes('-grill-'),
    );

    await ctx.db.patch(phase._id, {
      questions: nonGrillQuestions,
      grillSession: undefined,
    });

    await ctx.db.patch(args.projectId, {
      updatedAt: getNextUpdatedAt(project.updatedAt, Date.now()),
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
  args: { projectId: Id<'projects'> },
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

  const claims = await ctx.db
    .query('claims')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const claim of claims) {
    const links = await ctx.db
      .query('evidenceLinks')
      .withIndex('by_claim', (q) => q.eq('claimId', claim._id))
      .collect();
    for (const link of links) await ctx.db.delete(link._id);
    const reviews = await ctx.db
      .query('evidenceReviews')
      .withIndex('by_claim', (q) => q.eq('claimId', claim._id))
      .collect();
    for (const review of reviews) await ctx.db.delete(review._id);
    await ctx.db.delete(claim._id);
  }
  const sources = await ctx.db
    .query('evidenceSources')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  for (const source of sources) await ctx.db.delete(source._id);

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
