import { isGrillQuestion, newQuestionId, originFromLegacyFlag, type PhaseQuestion } from './question-model';

export interface BackfillResult {
  questions: PhaseQuestion[];
  /** Old id to new id, for the questions this pass gave a stable id. */
  idMap: Record<string, string>;
  migrated: number;
}

/**
 * Brings questions stored before `source`, `feeds` and `answerOrigin` existed up to the current shape.
 *
 * A question that already has `source` is left exactly as it is, which is what makes a second pass
 * over the same phase change nothing. An old AI-flagged answer becomes `accepted` rather than
 * `drafted`: the flag cannot tell a suggestion the user chose from a batch fill, and `accepted`
 * keeps the prompt as it reads today instead of relabelling decisions the user may have made.
 */
export function backfillQuestions(
  questions: readonly PhaseQuestion[],
  makeId: () => string = newQuestionId,
): BackfillResult {
  const idMap: Record<string, string> = {};
  let migrated = 0;

  const result = questions.map((question) => {
    if (question.source !== undefined) return question;

    const id = makeId();
    idMap[question.id] = id;
    migrated += 1;

    const hasAnswer = Boolean(question.answer?.trim());
    return {
      ...question,
      id,
      source: isGrillQuestion(question) ? ('grill' as const) : ('phase' as const),
      feeds: question.feeds ?? [],
      ...(hasAnswer
        ? { answerOrigin: question.answerOrigin ?? originFromLegacyFlag(question.aiGenerated) ?? 'user' }
        : {}),
    };
  });

  return { questions: result, idMap, migrated };
}

interface SessionWithQuestionIds {
  rounds: Array<{ questions: Array<{ id: string }> }>;
}

/** The Stress-Test session with its question ids following the questions they describe. */
export function remapSessionIds<S extends SessionWithQuestionIds>(session: S, idMap: Record<string, string>): S {
  return {
    ...session,
    rounds: session.rounds.map((round) => ({
      ...round,
      questions: round.questions.map((question) => ({ ...question, id: idMap[question.id] ?? question.id })),
    })),
  };
}
