/**
 * Acceptance criteria classification.
 *
 * A task's acceptance criteria are the last quality signal before a coding agent builds from them,
 * and a criterion nothing can check is worth nothing. This module classifies one criterion as one of
 * three things:
 *
 *   observable    names a result a check can confirm
 *   unobservable  asserts something, but nothing checks it
 *   vague         names no subject and no outcome
 *
 * Deliberately not a language model. This classification reaches an exported artifact and a user's
 * decision to accept a document, so it has to be reproducible: the same criterion always gets the
 * same class, and the corpus in `__tests__/acceptance-criteria.test.ts` locks the behaviour against
 * drift. A model's opinion of a criterion cannot be regression-tested, which is why
 * `lib/llm/prompts/critic.ts` is not reused for it.
 *
 * The rules run in this order and the first match wins:
 *
 *   1. a measured signal — a quantity with a unit, a stated bound, or an HTTP status — makes the
 *      criterion observable
 *   2. a quality word with no measurement makes it unobservable
 *   3. a named effect with no measurement — a result verb, or a permission to perform an action —
 *      makes it observable
 *   4. nothing specific left once the generic vocabulary is removed makes it vague
 *   5. anything else is unobservable
 *
 * A quality word sits between the two kinds of signal on purpose. "Returns 200 within 200ms" is
 * observable because a measurement outranks an adjective. "Responds quickly" is unobservable because
 * a bare verb does not, which a probe of the first draft caught: it read the verb `responds` and
 * passed a criterion with no threshold. The two signal groups exist to keep that distinction.
 *
 * Rule 5 is the default because a criterion that reaches it asserted something; the reader simply has
 * no check for it. `vague` is reserved for a criterion that names nothing at all, which is a
 * different problem with a different fix: an unobservable criterion needs a threshold, a vague one
 * needs a subject.
 */

export type AcceptanceCriterionClass = 'observable' | 'unobservable' | 'vague';

interface Signal {
  id: string;
  why: string;
  pattern: RegExp;
}

/**
 * A measurement. These outrank a quality word, because a number settles the argument an adjective
 * starts.
 */
const MEASURED_SIGNALS: readonly Signal[] = [
  {
    id: 'measured-threshold',
    why: 'states a quantity with a unit, so there is a number to compare against',
    pattern:
      /\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|secs?|seconds?|mins?|minutes?|hrs?|hours?|days?|weeks?|months?|years?|%|percent|kb|mb|gb|tb|bytes?|chars?|characters?|items?|rows?|records?|requests?|entries?|files?|tokens?|words?|px|rem)\b/i,
  },
  {
    id: 'stated-bound',
    why: 'states a bound alongside a number, so the reader knows what to measure and against what',
    pattern:
      /\b(?:at least|at most|no more than|no fewer than|fewer than|less than|more than|greater than|exactly|between|within|under|over|after|before)\b[^.]*\d/i,
  },
  {
    id: 'measured-status',
    why: 'names an HTTP status a request can be checked against',
    pattern: /\b[1-5]\d{2}\b/,
  },
];

/**
 * A named effect with no measurement. Weaker than a measurement, so a quality word beats it, but
 * still a result a reader could go and check.
 */
const EFFECT_SIGNALS: readonly Signal[] = [
  {
    id: 'result-verb',
    why: 'names the observable effect: a value returned, a state entered, a record written, an error raised',
    pattern:
      /\b(?:returns?|returned|sets?|writes?|wrote|written|creates?|created|rejects?|rejected|accepts?|accepted|denies?|denied|raises?|raised|throws?|threw|emits?|emitted|logs?|logged|records?|recorded|stores?|stored|persists?|persisted|retains?|retained|deletes?|deleted|removes?|removed|redirects?|redirected|renders?|rendered|displays?|displayed|shows?|showed|sends?|sent|responds?|responded|updates?|updated|marks?|marked|assigns?|assigned|increments?|incremented|decrements?|blocks?|blocked|allows?|allowed|permits?|permitted|prevents?|prevented|exposes?|exposed|leaks?|leaked|expires?|expired|resolves?|resolved|equals?|matches?|matched|fails?|failed|pass(?:es|ed)?|succeeds?|succeeded|contains?|includes?|included|reports?|reported)\b/i,
  },
  {
    id: 'named-permission',
    why: 'grants or forbids a named action, which a reader confirms by attempting it',
    // `(?!be\b)` keeps "may be scalable" out of this rule. That is a quality claim, not a permission,
    // and it must fall through to the quality-word rule instead.
    pattern:
      /\b(?:may|can|must be able to|is allowed to|are allowed to|is denied|are denied)\s+(?!be\b)[a-z]+/i,
  },
];

/**
 * Words that assert a quality without saying how it would be measured. A threshold elsewhere in the
 * criterion overrides this, which is why the result signals run first.
 */
const QUALITY_WORDS: ReadonlySet<string> = new Set([
  'fast', 'faster', 'fastest', 'slow', 'quick', 'quickly', 'snappy',
  'robust', 'reliable', 'reliably', 'resilient',
  'intuitive', 'intuitively', 'usable', 'friendly',
  'scalable', 'seamless', 'seamlessly', 'smooth', 'smoothly',
  'efficient', 'efficiently', 'performant', 'optimized', 'optimal', 'optimize',
  'responsive', 'secure', 'securely', 'safe', 'safely',
  'simple', 'simply', 'easy', 'easily', 'straightforward',
  'clean', 'cleaner', 'maintainable', 'readable', 'modern', 'flexible',
  'powerful', 'lightweight', 'beautiful', 'polished', 'elegant', 'elegantly',
  'good', 'better', 'great', 'best', 'nice', 'delightful',
  'reasonable', 'appropriate', 'appropriately', 'proper', 'properly',
  'adequate', 'adequately', 'sufficient', 'comprehensive', 'thorough',
  'correct', 'correctly', 'consistent', 'consistently', 'graceful', 'gracefully',
  'minimal', 'slick',
]);

/** Verbs that name an activity rather than a result. */
const GENERIC_VERBS: ReadonlySet<string> = new Set([
  'handle', 'support', 'add', 'improve', 'enhance', 'optimize', 'ensure', 'make',
  'do', 'work', 'implement', 'provide', 'include', 'create', 'update', 'manage',
  'process', 'fix', 'clean', 'write', 'test', 'validate', 'build', 'use', 'allow',
  'enable', 'consider', 'address', 'cover', 'maintain',
]);

/** Nouns that name a category rather than a subject. */
const GENERIC_NOUNS: ReadonlySet<string> = new Set([
  'edge', 'case', 'error', 'exception', 'thing', 'stuff', 'requirement', 'feature',
  'functionality', 'scenario', 'data', 'input', 'output', 'system', 'app',
  'application', 'ui', 'ux', 'code', 'behaviour', 'behavior', 'validation', 'test',
  'testing', 'documentation', 'docs', 'flow', 'content', 'page', 'screen',
  'component', 'part', 'aspect', 'task', 'item', 'value', 'condition', 'tbd',
  'todo', 'none', 'na',
]);

const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'can',
  'could', 'do', 'does', 'for', 'from', 'has', 'have', 'if', 'in', 'into', 'is',
  'it', 'its', 'may', 'must', 'no', 'not', 'of', 'on', 'or', 'our', 'should',
  'so', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'those', 'to', 'was', 'were', 'when', 'where', 'which', 'while', 'who',
  'will', 'with', 'without', 'would', 'your', 'we', 'us', 'each', 'any', 'all',
  'only', 'also', 'still', 'very', 'more', 'most', 'less', 'least', 'up', 'down',
  'out', 'off', 'over', 'under', 'after', 'before', 'between', 'exactly',
  'everything', 'something', 'anything', 'nothing',
]);

/** Strip markdown emphasis, a code span, and a leading list marker, then collapse the whitespace. */
function normalizeCriterion(criterion: string): string {
  return criterion
    .replace(/[`*_~]/g, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
}

/**
 * A quality word, allowing for the adverb a criterion usually writes. A corpus case on "removes it
 * cleanly" caught that the list held the adjective only, so the adverb form is derived rather than
 * enumerated: strip `-ably`, `-ily` or `-ly` and test the stem. That covers "cleanly" from "clean",
 * "easily" from "easy", and "reliably" from "reliable" without three more list entries per word.
 */
function isQualityWord(word: string): boolean {
  if (QUALITY_WORDS.has(word)) return true;
  if (word.endsWith('s') && QUALITY_WORDS.has(word.slice(0, -1))) return true;

  const stems: string[] = [];
  if (word.endsWith('ably')) stems.push(`${word.slice(0, -4)}able`);
  if (word.endsWith('ily')) stems.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('ly')) stems.push(word.slice(0, -2));

  return stems.some((stem) => QUALITY_WORDS.has(stem));
}

/** A word is generic if it, or its singular, is in the generic vocabulary. */
function isGenericWord(word: string): boolean {
  const singular = word.endsWith('s') ? word.slice(0, -1) : word;
  return (
    GENERIC_VERBS.has(word) ||
    GENERIC_VERBS.has(singular) ||
    GENERIC_NOUNS.has(word) ||
    GENERIC_NOUNS.has(singular) ||
    isQualityWord(word)
  );
}

/**
 * Classify one acceptance criterion. Pure and deterministic: no model call, no clock, no randomness,
 * so the same criterion always gets the same answer.
 */
export function classifyCriterion(criterion: string): AcceptanceCriterionClass {
  const text = normalizeCriterion(criterion);
  if (text === '') return 'vague';

  if (MEASURED_SIGNALS.some((signal) => signal.pattern.test(text))) {
    return 'observable';
  }

  const words = wordsOf(text);
  if (words.some((word) => isQualityWord(word))) {
    return 'unobservable';
  }

  if (EFFECT_SIGNALS.some((signal) => signal.pattern.test(text))) {
    return 'observable';
  }

  const specific = words.filter(
    (word) => !STOPWORDS.has(word) && !isGenericWord(word)
  );

  return specific.length === 0 ? 'vague' : 'unobservable';
}

/** Classify a list of criteria, in order. The index of a result lines up with the input. */
export function classifyCriteria(
  criteria: readonly string[]
): AcceptanceCriterionClass[] {
  return criteria.map(classifyCriterion);
}
