import { describe, expect, it } from 'vitest';
import {
  CHARACTERS_PER_TOKEN,
  CHARACTERS_PER_WORD,
  OVER_BUDGET_TOLERANCE,
  WORDS_PER_TOKEN,
  isOverBudget,
  phaseBudget,
  promptTokens,
  sectionBudget,
  stageBudget,
  tokensForWords,
  wordsForTokens,
} from '../budgets';
import { estimateTokenCount } from '../../llm/chunking';
import { calculateTotalTokens } from '../../llm/section-plans';
import { sectionsFor } from '../../specification/phase-sections';
import { WORKFLOW_STAGES } from '../../workflow';

describe('the words-per-token ratio', () => {
  it('is derived from the two stated inputs rather than written independently', () => {
    expect(WORDS_PER_TOKEN).toBe(CHARACTERS_PER_TOKEN / CHARACTERS_PER_WORD);
  });

  it('agrees with the estimator the rest of the repository uses', () => {
    // The anchoring fact: `estimateTokenCount` counts characters / 4, so the ratio has to be built on
    // that rather than on a remembered "tokens are about 0.75 words".
    const sample = 'The archive endpoint returns 204 for an editor and 403 for a viewer.';
    expect(estimateTokenCount(sample)).toBe(Math.ceil(sample.length / CHARACTERS_PER_TOKEN));
  });

  it('puts a realistic paragraph within fifteen percent of its real word count', () => {
    // Guards a gross mismatch rather than precision. The band is tight enough to fail if the constant
    // moves to 5, which over-counts words by 19 percent, or to 8, which under-counts by a quarter.
    const paragraph = [
      'A specification states an outcome a reader can verify. Every later document depends on this',
      'one being right, so a requirement names its subject, carries one obligation, and traces to the',
      'answer, rule, or file that settles it. Where nothing settles it, the requirement says so',
      'rather than asserting a fact. Quality words state no outcome and no threshold, so each is',
      'replaced by the measurement that would settle it, or dropped entirely.',
    ].join(' ');

    const realWords = paragraph.split(/\s+/).filter(Boolean).length;
    const estimatedWords = wordsForTokens(estimateTokenCount(paragraph));

    expect(estimatedWords).toBeGreaterThan(realWords * 0.85);
    expect(estimatedWords).toBeLessThan(realWords * 1.15);
  });

  it('keeps characters per word in a plausible range for English prose', () => {
    // A constant of 1 or 50 would satisfy the derivation above while making the budget nonsense.
    expect(CHARACTERS_PER_WORD).toBeGreaterThanOrEqual(4.5);
    expect(CHARACTERS_PER_WORD).toBeLessThanOrEqual(7.5);
  });
});

describe('wordsForTokens and tokensForWords', () => {
  it('converts a plan estimate to words', () => {
    // Two thirds of a token count, rounded. 1500 and 1200 are exact; 1000 is not, and rounds.
    expect(wordsForTokens(1500)).toBe(1000);
    expect(wordsForTokens(1200)).toBe(800);
    expect(wordsForTokens(1000)).toBe(667);
    expect(wordsForTokens(0)).toBe(0);
  });

  it('round-trips a word count back to the token estimate it came from', () => {
    expect(tokensForWords(wordsForTokens(1500))).toBe(1500);
    expect(tokensForWords(1000)).toBe(1500);
    expect(tokensForWords(800)).toBe(1200);
  });
});

describe('sectionBudget', () => {
  it('reads estimatedTokens from a plan', () => {
    expect(sectionBudget({ estimatedTokens: 1200 })).toEqual({ tokens: 1200, words: 800 });
  });

  it('accepts a token count directly', () => {
    expect(sectionBudget(1500)).toEqual({ tokens: 1500, words: 1000 });
  });
});

describe('phaseBudget', () => {
  it('sums the phase plan and reports how many sections it covers', () => {
    const plans = sectionsFor('prd');
    const budget = phaseBudget('prd');

    expect(budget.sections).toBe(plans.length);
    expect(budget.tokens).toBe(calculateTotalTokens(plans));
    expect(budget.words).toBe(wordsForTokens(calculateTotalTokens(plans)));
  });

  it('reports an empty budget for a phase with no plan, rather than throwing', () => {
    expect(phaseBudget('not-a-phase')).toEqual({ tokens: 0, words: 0, sections: 0 });
  });
});

describe('stageBudget', () => {
  it('is the sum of its sections across the stage phases', () => {
    // Derived here from the same sources the implementation reads, so the expectation is an
    // independent statement of "the sum of its sections" rather than a copy of the implementation.
    const design = WORKFLOW_STAGES.find((stage) => stage.id === 'design');
    const plans = (design?.phaseIds ?? []).flatMap((phaseId) =>
      sectionsFor(phaseId)
    );
    const tokens = calculateTotalTokens(plans);

    expect(stageBudget('design')).toEqual({
      tokens,
      words: wordsForTokens(tokens),
      sections: plans.length,
    });
  });

  it('covers every phase its stage groups', () => {
    const design = WORKFLOW_STAGES.find((stage) => stage.id === 'design');
    const expectedSections = (design?.phaseIds ?? []).reduce(
      (total, phaseId) => total + sectionsFor(phaseId).length,
      0
    );

    expect(stageBudget('design').sections).toBe(expectedSections);
    expect(stageBudget('design').sections).toBeGreaterThan(phaseBudget('specs').sections);
  });

  it('converts the summed tokens once, so it agrees with the token total', () => {
    // Adding rounded per-section words can differ by a word or two. The word budget has to agree with
    // the token total a user sees in the plan preview.
    const design = WORKFLOW_STAGES.find((stage) => stage.id === 'design');
    const tokens = (design?.phaseIds ?? []).reduce(
      (total, phaseId) => total + phaseBudget(phaseId).tokens,
      0
    );

    expect(stageBudget('design').words).toBe(wordsForTokens(tokens));
  });

  it('reports zeros for an unknown stage instead of throwing', () => {
    expect(stageBudget('not-a-stage' as never)).toEqual({ tokens: 0, words: 0, sections: 0 });
  });
});

describe('isOverBudget', () => {
  it('is not over at exactly the budget', () => {
    expect(isOverBudget(1200, 1200)).toBe(false);
  });

  it('is not over within the stated tolerance, so a slightly long document is not nagged', () => {
    expect(isOverBudget(Math.floor(1200 * (1 + OVER_BUDGET_TOLERANCE)), 1200)).toBe(false);
  });

  it('is over beyond the tolerance', () => {
    expect(isOverBudget(Math.ceil(1200 * (1 + OVER_BUDGET_TOLERANCE)) + 1, 1200)).toBe(true);
  });

  it('is over when a document exists against a zero budget', () => {
    expect(isOverBudget(1, 0)).toBe(true);
  });

  it('is not over when there is nothing to measure', () => {
    expect(isOverBudget(0, 0)).toBe(false);
  });
});

describe('promptTokens', () => {
  it('sums the parts with the same estimator as the rest of the repository', () => {
    const first = 'You are writing the requirements for a software project.';
    const second = 'Document quality: cover the section completely.';

    expect(promptTokens([first, second])).toBe(
      estimateTokenCount(first) + estimateTokenCount(second)
    );
  });

  it('ignores absent and empty parts, so an optional prompt part costs nothing', () => {
    expect(promptTokens(['abc', null, undefined, ''])).toBe(estimateTokenCount('abc'));
    expect(promptTokens([])).toBe(0);
  });
});
