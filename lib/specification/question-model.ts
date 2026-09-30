import { sectionIdsFor } from './phase-sections';

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

/** A clarifying question as stored on a phase. */
export interface PhaseQuestion {
  id: string;
  text: string;
  answer?: string;
  /** Legacy. Whether the model wrote the question or the answer, depending on when it was set. */
  aiGenerated: boolean;
  required?: boolean;
  suggestions?: string[];
  selectedSuggestionIndex?: number;
  source?: QuestionSource;
  /** Section ids of the phase this question informs. Empty or absent means the whole phase. */
  feeds?: string[];
  answerOrigin?: AnswerOrigin;
}

/**
 * The section ids a model named that the phase really has, without repeats.
 *
 * A name the model invented is dropped instead of trusted, because a question that feeds a section
 * which is never generated would feed nothing.
 */
export function sanitizeFeeds(feeds: unknown, phaseId: string): string[] {
  if (!Array.isArray(feeds)) return [];
  const known = new Set(sectionIdsFor(phaseId));
  const kept: string[] = [];
  for (const feed of feeds) {
    if (typeof feed === 'string' && known.has(feed) && !kept.includes(feed)) kept.push(feed);
  }
  return kept;
}

/** Whether a question came from Stress-Test, including ones stored before `source` existed. */
export function isGrillQuestion(question: Pick<PhaseQuestion, 'id' | 'source'>): boolean {
  return question.source === 'grill' || question.id.includes('-grill-');
}
