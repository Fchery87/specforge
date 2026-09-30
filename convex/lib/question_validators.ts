import { v } from 'convex/values';

export const answerOriginValidator = v.union(
  v.literal('user'),
  v.literal('accepted'),
  v.literal('drafted'),
);

export const questionSourceValidator = v.union(v.literal('phase'), v.literal('grill'));

/**
 * One clarifying question on a phase. The single definition the schema and both writers share, so a
 * field added here reaches every write path at once.
 */
export const phaseQuestionValidator = v.object({
  id: v.string(),
  text: v.string(),
  answer: v.optional(v.string()),
  // Legacy. Optional until the backfill has stripped it from every stored question, then removed.
  aiGenerated: v.optional(v.boolean()),
  required: v.optional(v.boolean()),
  // AI-generated selectable suggestion options
  suggestions: v.optional(v.array(v.string())),
  selectedSuggestionIndex: v.optional(v.number()),
  source: v.optional(questionSourceValidator),
  // Section ids of the phase this question informs. Empty or absent means the whole phase.
  feeds: v.optional(v.array(v.string())),
  answerOrigin: v.optional(answerOriginValidator),
});

/** A Stress-Test session. `recommendedAnswer` is optional because a question may carry none. */
export const grillSessionValidator = v.object({
  totalQuestionsAsked: v.number(),
  currentRound: v.number(),
  isComplete: v.boolean(),
  rounds: v.array(
    v.object({
      roundNumber: v.number(),
      questions: v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          recommendedAnswer: v.optional(v.string()),
          options: v.optional(v.array(v.string())),
          category: v.optional(v.string()),
          userAnswer: v.optional(v.string()),
          acceptedRecommendation: v.optional(v.boolean()),
        }),
      ),
    }),
  ),
});
