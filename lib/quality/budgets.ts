import { WORKFLOW_STAGES, type StageId } from '../workflow';
import type { SectionPlanConfig } from '../llm/section-plans';
import { sectionsFor } from '../specification/phase-sections';
import { estimateTokenCount } from '../llm/chunking';

/**
 * Document length budgets.
 *
 * A section plan already estimates how many tokens a section should take to write. A reader cannot
 * judge a token count, and neither can a writer, so the budget this module reports is in words. The
 * conversion is derived rather than asserted, because a magic number that disagrees with the rest of
 * the repository is worse than no number at all.
 *
 * The derivation, in this repository's own units:
 *
 *   - `estimateTokenCount` in `lib/llm/chunking.ts` counts `characters / 4`, and that is the token
 *     convention every other measurement here uses.
 *   - Prose in this repository measures 6.39 characters per word, including the space that separates
 *     words. That figure came from its own documents: `docs/design.md`, the Ember ADR, this phase's
 *     spec, the README and the roadmap, with fenced code, tables and markdown syntax removed, which
 *     is 25,964 characters over 4,064 words. Re-measure the same way if the corpus looks different
 *     from what these constants produce.
 *
 * So one token is `4 / 6`, or two thirds of a word. The test that guards this does not assert those
 * numbers against themselves: it measures a paragraph with `estimateTokenCount` and checks the
 * derived ratio against that paragraph's real word count. If either input changes, that test fails
 * rather than the budget quietly drifting.
 *
 * The estimate is for prose. Documents carrying code blocks, tables and long identifiers have more
 * characters per word still, so a real document can come in under its word budget.
 */

/** Characters per token. Matches `estimateTokenCount` in `lib/llm/chunking.ts`. */
export const CHARACTERS_PER_TOKEN = 4;

/**
 * Characters per word in prose, including the separating space.
 *
 * Measured at 6.39 across this repository's own documents and rounded down to 6 deliberately. The
 * word budget is `characters / CHARACTERS_PER_WORD`, so a lower figure yields a larger budget, and the
 * spec asks the first version to err toward generous rather than strict. Rounding down makes a
 * document about six percent longer than the measurement implies before it is reported as over.
 */
export const CHARACTERS_PER_WORD = 6;

/** Words per token, derived from the two constants above rather than written independently. */
export const WORDS_PER_TOKEN = CHARACTERS_PER_TOKEN / CHARACTERS_PER_WORD;

/**
 * How far over budget a document may run before it is reported as over.
 *
 * The budget is a signal about the author, not a limit on the output, so a document that is a little
 * long is not a problem worth a reader's attention. Twenty percent is wide enough that ordinary
 * estimate error does not trip it, and narrow enough that a document twice the intended length does.
 */
export const OVER_BUDGET_TOLERANCE = 0.2;

export interface TokenWordBudget {
  /** The estimate as planned, in tokens. */
  tokens: number;
  /** The same estimate in words, which is what a reader can judge. */
  words: number;
}

export interface StageBudget extends TokenWordBudget {
  /** How many sections the budget covers, so a caller can tell an empty stage from a small one. */
  sections: number;
}

/** A token estimate as a word budget. */
export function wordsForTokens(tokens: number): number {
  return Math.round(tokens * WORDS_PER_TOKEN);
}

/** A word count as the token estimate it corresponds to. */
export function tokensForWords(words: number): number {
  return Math.round(words / WORDS_PER_TOKEN);
}

/**
 * The budget for one section, from its plan or from an `estimatedTokens` value directly.
 *
 * Accepting the plan as well as the number keeps the caller from having to know which field to read,
 * which is how the two got out of step elsewhere in this codebase.
 */
export function sectionBudget(
  input: number | Pick<SectionPlanConfig, 'estimatedTokens'>
): TokenWordBudget {
  const tokens = typeof input === 'number' ? input : input.estimatedTokens;
  return { tokens, words: wordsForTokens(tokens) };
}

/**
 * The budget for a phase, from every section its plan defines.
 *
 * Tokens are summed first and converted once. Adding the rounded per-section words instead can differ
 * by a word or two, and this way the word budget always agrees with the token total that
 * `calculateTotalTokens` reports in the plan preview, which a user comparing the two would expect.
 */
export function phaseBudget(phaseId: string): StageBudget {
  const plans = sectionsFor(phaseId);
  const tokens = plans.reduce((total, plan) => total + plan.estimatedTokens, 0);
  return { tokens, words: wordsForTokens(tokens), sections: plans.length };
}

/**
 * The budget for a stage: its phases' sections summed, then converted once.
 *
 * An unknown stage or a phase with no plan yields zeros rather than throwing, so a report renders a
 * gap instead of breaking the page it is on. `sections` is what distinguishes that from a stage that
 * genuinely has a zero-token plan.
 */
export function stageBudget(stageId: StageId): StageBudget {
  const stage = WORKFLOW_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) return { tokens: 0, words: 0, sections: 0 };

  let tokens = 0;
  let sections = 0;
  for (const phaseId of stage.phaseIds) {
    const plan = phaseBudget(phaseId);
    tokens += plan.tokens;
    sections += plan.sections;
  }

  return { tokens, words: wordsForTokens(tokens), sections };
}

/** Whether a word count exceeds a word budget, allowing the stated tolerance. */
export function isOverBudget(wordCount: number, budgetWords: number): boolean {
  if (budgetWords <= 0) return wordCount > 0;
  return wordCount > budgetWords * (1 + OVER_BUDGET_TOLERANCE);
}

/**
 * What a set of prompt parts costs in tokens, measured the way the rest of the repository measures.
 *
 * Prompt size is deliberately outside a document budget. The budgets above answer "how long should
 * this document be", which is a quantity a reader can check against the page. The input a generation
 * request pays for is a different quantity and is not fixed per stage: the codebase-context block
 * alone folds up to twenty files of repository text into the section instructions, and the previous
 * sections are bounded separately, so a per-stage constant would be wrong by an order of magnitude
 * for some projects and would give a false sense of accounting.
 *
 * So it is measured where it is spent rather than modelled here. This function exists so the
 * generation path can do that with the same estimator, and so a caller can see the number rather than
 * infer it.
 */
export function promptTokens(parts: readonly (string | null | undefined)[]): number {
  return parts.reduce<number>(
    (total, part) => (part ? total + estimateTokenCount(part) : total),
    0
  );
}
