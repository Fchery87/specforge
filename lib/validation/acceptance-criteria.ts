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
      /\b(?:returns?|returned|sets?|writes?|wrote|written|creates?|created|cleans|cleaned|rejects?|rejected|accepts?|accepted|denies?|denied|raises?|raised|throws?|threw|emits?|emitted|logs?|logged|records?|recorded|stores?|stored|persists?|persisted|retains?|retained|deletes?|deleted|removes?|removed|redirects?|redirected|renders?|rendered|displays?|displayed|shows?|showed|sends?|sent|responds?|responded|updates?|updated|marks?|marked|assigns?|assigned|increments?|incremented|decrements?|blocks?|blocked|allows?|allowed|permits?|permitted|prevents?|prevented|exposes?|exposed|leaks?|leaked|expires?|expired|resolves?|resolved|equals?|matches?|matched|fails?|failed|pass(?:es|ed)?|succeeds?|succeeded|contains?|includes?|included|reports?|reported)\b/i,
  },
  {
    id: 'named-permission',
    why: 'grants or forbids a named action, which a reader confirms by attempting it',
    // The lookahead excludes linking verbs, not just `be`. `may` and `can` are modals of possibility
    // as well as permission, so "the system may feel unresponsive" and "the button can look sluggish"
    // are quality claims. The first version excluded only `be`, so every other linking verb let a
    // bare quality claim through as a permission and the criterion exported as observable.
    pattern:
      /\b(?:may|can|must be able to|is allowed to|are allowed to|is denied|are denied)\s+(?!(?:be|feel|feels|seem|seems|look|looks|become|becomes|appear|appears|stay|stays|sound|sounds|taste|tastes|grow|grows|remain|remains|prove|proves|get|gets)\b)[a-z]+/i,
  },
];

/**
 * Words that assert a quality without saying how it would be measured. A threshold elsewhere in the
 * criterion overrides this, which is why the result signals run first.
 *
 * A word list cannot be complete, so this is not the only defence: the effect signals are checked
 * after it, which means an unlisted quality adjective still passes if the criterion also contains a
 * result verb. Widening the list is therefore the fix for a specific miss, not a general one.
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
  // Adjectives a reviewer found slipping past this list while still naming no outcome.
  'pleasant', 'professional', 'attractive', 'helpful', 'accessible',
  'understandable', 'stable', 'cohesive', 'transparent', 'effortless',
  'thoughtful', 'tasteful', 'predictable', 'discoverable', 'memorable',
  'engaging', 'sleek', 'streamlined', 'refined', 'robustness',
]);

/**
 * Adverbs of degree modify another word rather than asserting a quality of the subject, so they must
 * not be stemmed onto a quality adjective. "greatly" stems to "great" and would otherwise suppress a
 * real result verb in the same criterion.
 */
const DEGREE_ADVERBS: ReadonlySet<string> = new Set([
  'greatly', 'highly', 'largely', 'mostly', 'nearly', 'extremely', 'really',
  'quite', 'slightly', 'fairly', 'rather', 'utterly', 'totally', 'completely',
  'particularly', 'especially', 'generally', 'usually', 'typically', 'often',
  'sometimes', 'always', 'never', 'mainly', 'chiefly', 'mostly', 'widely',
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
 *
 * A trailing `-s` is deliberately not stripped here. It looked harmless, but `goods` then stems to
 * `good`, so "the warehouse stores goods" was demoted to unobservable and its real result verb lost.
 * Plurals of quality adjectives are not a thing in practice; plurals of nouns are.
 */
function isQualityWord(word: string): boolean {
  if (QUALITY_WORDS.has(word)) return true;
  if (DEGREE_ADVERBS.has(word)) return false;

  const stems: string[] = [];
  if (word.endsWith('ably')) stems.push(`${word.slice(0, -4)}able`);
  if (word.endsWith('ily')) stems.push(`${word.slice(0, -3)}y`);
  if (word.endsWith('ly')) stems.push(word.slice(0, -2));

  return stems.some((stem) => QUALITY_WORDS.has(stem));
}

/**
 * Inflected forms of a word, so a generic verb matches whether it is written as a base form or as a
 * participle. Without this, "Handle edge cases." was vague while "Handling edge cases." was
 * unobservable, so the same criterion changed class by adding a tense.
 */
function inflectionStems(word: string): string[] {
  const stems: string[] = [];

  if (word.endsWith('ing')) {
    const base = word.slice(0, -3);
    stems.push(base, `${base}e`, base.slice(0, -1));
  }
  if (word.endsWith('ed')) {
    const base = word.slice(0, -2);
    stems.push(base, `${base}e`, base.slice(0, -1));
  }
  if (word.endsWith('es')) stems.push(word.slice(0, -2));
  if (word.endsWith('s')) stems.push(word.slice(0, -1));

  return stems;
}

/** A word is generic if it, or an inflected form of it, is in the generic vocabulary. */
function isGenericWord(word: string): boolean {
  const candidates = [word, ...inflectionStems(word)];
  return (
    candidates.some(
      (candidate) => GENERIC_VERBS.has(candidate) || GENERIC_NOUNS.has(candidate)
    ) || isQualityWord(word)
  );
}

/**
 * A determiner directly before a word makes it a noun rather than a verb.
 *
 * Most of the result verbs are also common specification nouns: report, record, log, mark, match,
 * store, set, update, block, pass, fail, show, display. Matching the bare word meant any criterion
 * that mentioned the noun was read as an effect. "The report should be clear" and "The user record
 * must be accurate" both exported as observable, and those nouns are everywhere in specification
 * prose, so this was the largest source of false observables in the module.
 */
const DETERMINER_BEFORE =
  /\b(?:the|a|an|this|that|these|those|its|their|your|our|his|her|any|each|every|no|one|two|three|both|all)\s*$/i;

/**
 * A copula or modal directly after a word makes that word the subject noun, not a verb.
 *
 * The determiner rule misses a noun that another noun modifies: "the user record must be accurate"
 * has no determiner before `record`. But a verb in that position would be followed by its object
 * ("records one event"), while the noun is followed by the clause's own verb.
 */
const VERB_AFTER =
  /^\s+(?:is|are|was|were|be|been|being|must|should|shall|will|would|can|could|may|might|has|have|had)\b/i;

/** True when a pattern matches somewhere it can be read as a verb, not as a determiner's noun. */
function matchesAsVerb(text: string, pattern: RegExp): boolean {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
  );

  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const readsAsVerb =
      !DETERMINER_BEFORE.test(before) && !VERB_AFTER.test(after);

    if (readsAsVerb) return true;

    // A zero-length match would spin forever; the patterns here cannot produce one, but the guard
    // costs nothing and this loop has no other exit.
    if (match[0] === "") global.lastIndex += 1;
  }
  return false;
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

  if (EFFECT_SIGNALS.some((signal) => matchesAsVerb(text, signal.pattern))) {
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

/**
 * A criterion's class as stored on a ticket, or `unclassified` when there is none.
 *
 * A ticket written before the class existed has no stored value, and the plan's rule is that such a
 * criterion reads as `unclassified` rather than being labelled retroactively: classifying it later
 * would report a judgement nobody made at the time, and the classification is a claim about the text
 * that a reader may want to check against the version that was reviewed.
 */
export type StoredCriterionClass = AcceptanceCriterionClass | 'unclassified';

const STORED_CLASSES: ReadonlySet<string> = new Set<AcceptanceCriterionClass>([
  'observable',
  'unobservable',
  'vague',
]);

/**
 * Pair each criterion with the class stored for it.
 *
 * The result is always the same length as `criteria`, so a reader can index the two together without
 * checking. A stored value this module does not recognise is treated as `unclassified` rather than
 * trusted: the field is persisted data, and a value that did not come from `classifyCriterion` is not
 * a class, whatever it says.
 */
export function criterionClasses(
  criteria: readonly string[],
  quality?: readonly string[] | null
): StoredCriterionClass[] {
  return criteria.map((_, index) => {
    const stored = quality?.[index];
    return stored && STORED_CLASSES.has(stored)
      ? (stored as AcceptanceCriterionClass)
      : 'unclassified';
  });
}

/**
 * Reject a supplied class list that does not have one entry per criterion.
 *
 * The pairing is positional, so a list shorter than the criteria silently moves classes onto the
 * wrong ones rather than reporting anything. An absent list is fine — that is a legacy row or a
 * caller that has no classes, and both read as `unclassified` — but a supplied list must line up.
 *
 * Convex validators check each argument's shape and cannot express a relation between two of them, so
 * this has to run in a handler. Kept here, pure, so it is testable without a deployment.
 */
export function assertCriteriaQualityAligned(
  criteria: readonly string[],
  quality?: readonly string[] | null
): void {
  if (quality == null) return;
  if (quality.length !== criteria.length) {
    throw new Error(
      `acceptanceCriteriaQuality must hold one entry per acceptance criterion: ` +
        `received ${quality.length} for ${criteria.length} criteria`
    );
  }
}
