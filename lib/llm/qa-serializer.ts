import {
  answersForSection,
  originFromLegacyFlag,
  sectionIdOfPlanEntry,
  type AnswerOrigin,
  type PhaseQuestion,
} from '../specification/question-model';

const PAIR_DELIMITER = '\n---QA---\n';
const ANSWER_DELIMITER = '\n>>>ANSWER>>>\n';
const META_DELIMITER = '\n>>>META>>>\n';

export interface QAPair {
  question: string;
  answer: string;
  /** Who wrote the answer. Absent on a pair serialized before origins existed, which reads as `user`. */
  origin?: AnswerOrigin;
  /** Sections of the phase the question informs. Absent or empty means the whole phase. */
  feeds?: string[];
  /** Set on a pair from an upstream phase, which is context for every section rather than aimed at one. */
  phaseId?: string;
}

interface QAPairMeta {
  origin?: AnswerOrigin;
  feeds?: string[];
  phaseId?: string;
}

function metaOf(pair: QAPair): QAPairMeta | null {
  const meta: QAPairMeta = {};
  if (pair.origin) meta.origin = pair.origin;
  if (pair.feeds?.length) meta.feeds = pair.feeds;
  if (pair.phaseId) meta.phaseId = pair.phaseId;
  return Object.keys(meta).length > 0 ? meta : null;
}

/**
 * Serializes Q&A pairs into a format that safely handles newlines and colons.
 * Filters out pairs with empty answers. Origin, feeds and phase travel with the pair.
 */
export function serializeQAPairs(pairs: QAPair[]): string {
  return pairs
    .filter((p) => p.answer?.trim())
    .map((p) => {
      const meta = metaOf(p);
      const tail = meta ? `${META_DELIMITER}${JSON.stringify(meta)}` : '';
      return `${p.question}${ANSWER_DELIMITER}${p.answer}${tail}`;
    })
    .join(PAIR_DELIMITER);
}

function splitMeta(answerAndMeta: string): { answer: string; meta: QAPairMeta } {
  const at = answerAndMeta.lastIndexOf(META_DELIMITER);
  if (at < 0) return { answer: answerAndMeta.trim(), meta: {} };
  try {
    const meta = JSON.parse(answerAndMeta.slice(at + META_DELIMITER.length)) as QAPairMeta;
    return { answer: answerAndMeta.slice(0, at).trim(), meta };
  } catch {
    return { answer: answerAndMeta.trim(), meta: {} };
  }
}

/**
 * Deserializes Q&A pairs. Supports both the new delimiter format and
 * the legacy "Q: A\nQ: A" format for backward compatibility.
 */
export function deserializeQAPairs(text: string | null | undefined): QAPair[] {
  if (!text?.trim()) return [];

  // New format: uses delimiters
  if (text.includes(ANSWER_DELIMITER)) {
    return text
      .split(PAIR_DELIMITER)
      .filter((block) => block.includes(ANSWER_DELIMITER))
      .map((block) => {
        const delimIndex = block.indexOf(ANSWER_DELIMITER);
        const { answer, meta } = splitMeta(block.substring(delimIndex + ANSWER_DELIMITER.length));
        const pair: QAPair = { question: block.substring(0, delimIndex).trim(), answer };
        if (meta.origin) pair.origin = meta.origin;
        if (meta.feeds?.length) pair.feeds = meta.feeds;
        if (meta.phaseId) pair.phaseId = meta.phaseId;
        return pair;
      })
      .filter((p) => p.question && p.answer);
  }

  // Legacy format: "Question: Answer\nQuestion: Answer"
  return text
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => {
      const colonIndex = line.indexOf(':');
      return {
        question: line.substring(0, colonIndex).trim(),
        answer: line.substring(colonIndex + 1).trim(),
      };
    })
    .filter((p) => p.question && p.answer);
}

/**
 * The pair generation reads for an answered question. An upstream question keeps its phase, which
 * marks it as context rather than as something aimed at a section of the phase being generated.
 */
export function qaPairFromQuestion(question: PhaseQuestion, upstreamPhaseId?: string): QAPair {
  const pair: QAPair = {
    question: upstreamPhaseId ? `[${upstreamPhaseId}] ${question.text}` : question.text,
    answer: question.answer ?? '',
    origin: question.answerOrigin ?? originFromLegacyFlag(question.aiGenerated) ?? 'user',
  };
  if (upstreamPhaseId) pair.phaseId = upstreamPhaseId;
  else if (question.feeds?.length) pair.feeds = question.feeds;
  return pair;
}

const ASSUMED_HEADING =
  'Assumed by the assistant, not reviewed by the user. Treat each as a default the document may state, and mark every requirement that depends on one as an assumption:';

/**
 * Formats Q&A pairs for prompt injection, separating what the user decided from what the assistant
 * assumed on their behalf. An answer the user typed or chose is a decision. A drafted answer they
 * never reviewed is a default, and the document has to say so.
 */
export function formatQAForPrompt(pairs: QAPair[]): string {
  const render = (list: QAPair[]) => list.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join('\n\n');
  const decided = pairs.filter((p) => p.origin !== 'drafted');
  const assumed = pairs.filter((p) => p.origin === 'drafted');
  const blocks: string[] = [];
  if (decided.length > 0) blocks.push(`Decided by the user:\n${render(decided)}`);
  if (assumed.length > 0) blocks.push(`${ASSUMED_HEADING}\n${render(assumed)}`);
  return blocks.join('\n\n');
}

/**
 * The answers to point one section at, from the serialized Q&A.
 *
 * Only the phase's own questions are routed. An upstream pair is context for every section and is
 * already in the system prompt, so it is not repeated as a point to address.
 */
export function answersToAddressForSection(text: string | null | undefined, sectionName: string): string[] {
  const own = deserializeQAPairs(text).filter((pair) => !pair.phaseId);
  return answersForSection(own, sectionIdOfPlanEntry(sectionName)).map(
    (pair) => `Q: ${pair.question}\nA: ${pair.answer}`,
  );
}
