import { internalAction, internalMutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { backfillQuestions, remapSessionIds } from '../lib/specification/question-backfill';
import { answerSourceKey, type PhaseQuestion } from '../lib/specification/question-model';

export interface BackfillCounts {
  phases: number;
  questions: number;
  evidenceSources: number;
}

const EMPTY_COUNTS: BackfillCounts = { phases: 0, questions: 0, evidenceSources: 0 };

/**
 * One page of phases: each question stored before `source` existed gets a stable id, its shape is
 * completed, and the evidence filed under its old id follows it. Safe to run again.
 */
export async function backfillPageHandler(
  ctx: MutationCtx,
  args: { cursor: string | null; numItems?: number },
) {
  const page = await ctx.db.query('phases').paginate({
    cursor: args.cursor,
    numItems: args.numItems ?? 25,
  });
  const counts: BackfillCounts = { ...EMPTY_COUNTS };

  for (const phase of page.page) {
    const { questions, idMap, migrated } = backfillQuestions(phase.questions as PhaseQuestion[]);
    if (migrated === 0) continue;

    for (const [oldId, newId] of Object.entries(idMap)) {
      const oldKey = answerSourceKey(phase.phaseId, oldId);
      const revisions = await ctx.db
        .query('evidenceSources')
        .withIndex('by_source', (q) => q.eq('projectId', phase.projectId).eq('sourceKey', oldKey))
        .collect();
      for (const revision of revisions) {
        await ctx.db.patch(revision._id, {
          sourceKey: answerSourceKey(phase.phaseId, newId),
          locator: `${phase.phaseId}/${newId}`,
        });
        counts.evidenceSources += 1;
      }
    }

    await ctx.db.patch(phase._id, {
      questions,
      ...(phase.grillSession ? { grillSession: remapSessionIds(phase.grillSession, idMap) } : {}),
    });
    counts.phases += 1;
    counts.questions += migrated;
  }

  return { continueCursor: page.continueCursor, isDone: page.isDone, counts };
}

export const backfillPhaseQuestionsPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
  handler: backfillPageHandler,
});

/** Runs the backfill over every phase, page by page, and returns the totals. */
export const backfillPhaseQuestions = internalAction({
  args: {},
  handler: async (ctx): Promise<BackfillCounts> => {
    const totals: BackfillCounts = { ...EMPTY_COUNTS };
    let cursor: string | null = null;
    for (;;) {
      const page: { continueCursor: string; isDone: boolean; counts: BackfillCounts } =
        await ctx.runMutation(internal.questionBackfill.backfillPhaseQuestionsPage, { cursor });
      totals.phases += page.counts.phases;
      totals.questions += page.counts.questions;
      totals.evidenceSources += page.counts.evidenceSources;
      if (page.isDone) return totals;
      cursor = page.continueCursor;
    }
  },
});
