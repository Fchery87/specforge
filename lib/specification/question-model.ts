import { sectionIdsFor, sectionsFor } from './phase-sections';

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
 * Whether a person stands behind the answer: they typed it or kept what the model wrote. Batch
 * drafting leaves these alone. A drafted answer nobody has reviewed is fair to redraft.
 */
export function hasReviewedAnswer(question: Pick<PhaseQuestion, 'answer' | 'answerOrigin'>): boolean {
  return Boolean(question.answer?.trim()) && question.answerOrigin !== 'drafted';
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
  required: boolean;
  suggestions?: string[];
  selectedSuggestionIndex?: number;
  source: QuestionSource;
  /** Section ids of the phase this question informs. Empty means the whole phase. */
  feeds: string[];
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

/** Whether a question came from Stress-Test. */
export function isGrillQuestion(question: Pick<PhaseQuestion, 'source'>): boolean {
  return question.source === 'grill';
}

/**
 * The id of the section a plan entry belongs to. A section split for a small output budget is named
 * `<id>-part-<n>`, and its answers are the parent section's.
 */
export function sectionIdOfPlanEntry(name: string): string {
  return name.replace(/-part-\d+$/, '');
}

/**
 * The answered questions that inform one section: those that name it, and those that name no section
 * and so inform the whole phase. A question aimed at another section is left out.
 */
export function answersForSection<T extends { answer?: string; feeds?: readonly string[] }>(
  questions: readonly T[],
  sectionId: string,
): T[] {
  return questions.filter(
    (question) =>
      Boolean(question.answer?.trim()) &&
      (!question.feeds?.length || question.feeds.includes(sectionId)),
  );
}

/**
 * The line under a question that says what it is for: the titles of the sections it feeds, or that
 * it feeds the whole document when it names none.
 */
export function feedsLabel(phaseId: string, feeds: readonly string[] | undefined): string {
  if (!feeds?.length) return 'Feeds the whole document';
  const titles = sectionsFor(phaseId);
  const named = feeds.map((id) => titles.find((section) => section.id === id)?.title ?? id);
  return `Feeds ${named.join(', ')}`;
}

/**
 * The evidence source an answer is filed under. The one definition: the answer writers file under it
 * and the backfill re-keys by it, so the two cannot disagree about what a question's history is.
 */
export function answerSourceKey(phaseId: string, questionId: string): string {
  return `answer:${phaseId}:${questionId}`;
}
