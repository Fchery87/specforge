/**
 * Who wrote an answer, which decides how generation treats it.
 *
 * `user` was typed by the user. `accepted` was written by the model and then chosen by the user: a
 * suggestion chip, a staged answer, a Stress-Test recommendation. `drafted` was written by the model
 * and not reviewed, which is what "Let AI answer all" produces.
 */
export type AnswerOrigin = 'user' | 'accepted' | 'drafted';

/** Where a question came from. Stress-Test questions are `grill`, every other question is `phase`. */
export type QuestionSource = 'phase' | 'grill';

/** The origin evidence records: the user's own words, or the assistant's. */
export function evidenceOriginFor(origin: AnswerOrigin): 'user' | 'assistant' {
  return origin === 'user' ? 'user' : 'assistant';
}

/**
 * The origin a legacy `aiGenerated` flag implies. The flag cannot tell a chosen suggestion from a
 * batch fill, so an AI answer reads as `accepted`, which keeps today's prompt behaviour.
 */
export function originFromLegacyFlag(aiGenerated: boolean | undefined): AnswerOrigin | undefined {
  if (aiGenerated === undefined) return undefined;
  return aiGenerated ? 'accepted' : 'user';
}

/** Whether the model wrote the answer, however far the user has since reviewed it. */
export function isModelWritten(origin: AnswerOrigin | undefined): boolean {
  return origin === 'accepted' || origin === 'drafted';
}

/** A question id that stays with its question. Positional ids (`brief-q1`) did not. */
export function newQuestionId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `q_${random}`;
}
