import { newQuestionId, originFromLegacyFlag, type PhaseQuestion } from './question-model';

/** A question as stored before the current shape, which may still carry the legacy `aiGenerated` flag. */
export type StoredQuestion = Omit<PhaseQuestion, 'source' | 'feeds' | 'required'> & {
  aiGenerated?: boolean;
  required?: boolean;
  source?: PhaseQuestion['source'];
  feeds?: string[];
};

export interface BackfillResult {
  questions: PhaseQuestion[];
  /** Old id to new id, for the questions this pass gave a stable id. */
  idMap: Record<string, string>;
  migrated: number;
}

/** A legacy Stress-Test id, from before `source` existed. Read only here, by the migration. */
function isLegacyGrillId(id: string): boolean {
  return id.includes('-grill-');
}

function isCurrent(question: StoredQuestion): boolean {
  return (
    question.source !== undefined &&
    question.feeds !== undefined &&
    question.required !== undefined &&
    !('aiGenerated' in question)
  );
}

/**
 * Brings stored questions up to the current shape: a stable id, `source`, `feeds`, `required` and an
 * answer origin, without the legacy `aiGenerated` flag.
 *
 * A question already in the current shape is returned as the same object, which is what makes a
 * second pass change nothing. One that was given a `source` by an earlier pass keeps its id and only
 * loses the flag. An old AI-flagged answer becomes `accepted` rather than `drafted`: the flag cannot
 * tell a suggestion the user chose from a batch fill, and `accepted` keeps the prompt as it reads
 * today instead of relabelling decisions the user may have made.
 */
export function backfillQuestions(
  questions: readonly StoredQuestion[],
  makeId: () => string = newQuestionId,
): BackfillResult {
  const idMap: Record<string, string> = {};
  let migrated = 0;

  const result = questions.map((question): PhaseQuestion => {
    if (isCurrent(question)) return question as PhaseQuestion;
    migrated += 1;

    const { aiGenerated, ...rest } = question;
    const needsId = question.source === undefined;
    const id = needsId ? makeId() : question.id;
    if (needsId) idMap[question.id] = id;

    const hasAnswer = Boolean(question.answer?.trim());
    return {
      ...rest,
      id,
      required: question.required ?? false,
      source: question.source ?? (isLegacyGrillId(question.id) ? 'grill' : 'phase'),
      feeds: question.feeds ?? [],
      ...(hasAnswer
        ? { answerOrigin: question.answerOrigin ?? originFromLegacyFlag(aiGenerated) ?? 'user' }
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
