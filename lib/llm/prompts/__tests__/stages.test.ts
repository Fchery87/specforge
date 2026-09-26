import { describe, expect, it } from 'vitest';
import {
  DESIGN_PROMPT,
  REQUIREMENTS_PROMPT,
  TASKS_PROMPT,
  stagePromptFor,
} from '../stages';

/**
 * Each assertion below is a property the product depends on, not a sentence in the prompt. Changing
 * the wording is fine; changing what the document must do should break a test here.
 */

describe('the requirements prompt', () => {
  it('states an outcome a reader can verify', () => {
    expect(REQUIREMENTS_PROMPT).toContain('observable outcome');
    expect(REQUIREMENTS_PROMPT).toContain('One obligation per statement');
  });

  it('forbids stating a solution as a requirement', () => {
    expect(REQUIREMENTS_PROMPT).toContain('is design');
    expect(REQUIREMENTS_PROMPT).toContain('let the design stage choose how');
  });

  it('requires every requirement to be traceable to a source', () => {
    expect(REQUIREMENTS_PROMPT).toContain('Trace each requirement to what settles it');
    expect(REQUIREMENTS_PROMPT).toContain('An inference is proposed, not confirmed');
  });

  it('names the quality words that state no outcome', () => {
    expect(REQUIREMENTS_PROMPT).toContain('no outcome and no threshold');
    expect(REQUIREMENTS_PROMPT).toMatch(/fast, robust, intuitive/);
  });
});

describe('the design prompt', () => {
  it('requires a test seam per contract', () => {
    expect(DESIGN_PROMPT).toContain('test seam');
    expect(DESIGN_PROMPT).toContain('without the whole system');
  });

  it('requires failure behaviour, not only the happy path', () => {
    expect(DESIGN_PROMPT).toContain('failure behaviour');
    expect(DESIGN_PROMPT).toContain('most defects live in the error path');
  });

  it('requires the decision and the rejected alternative', () => {
    expect(DESIGN_PROMPT).toContain('alternative that was rejected');
  });
});

describe('the tasks prompt', () => {
  it('requires acceptance criteria a test can assert', () => {
    expect(TASKS_PROMPT).toContain('acceptance criteria a test can assert');
    expect(TASKS_PROMPT).toContain('a concrete input, a concrete output, or a concrete state');
  });

  it('requires a vertical slice rather than a layer', () => {
    expect(TASKS_PROMPT).toContain('vertical slice');
    expect(TASKS_PROMPT).toContain('"update the schema"');
  });

  it('requires the blocking edges to be named', () => {
    expect(TASKS_PROMPT).toContain('blocking edges');
    expect(TASKS_PROMPT).toContain('derived from those edges rather than guessed');
  });
});

describe('stagePromptFor', () => {
  it('gives the Requirements stage to the brief and the PRD', () => {
    expect(stagePromptFor('brief')).toBe(REQUIREMENTS_PROMPT);
    expect(stagePromptFor('prd')).toBe(REQUIREMENTS_PROMPT);
  });

  it('gives the Design stage to every phase the stage groups', () => {
    expect(stagePromptFor('domainModel')).toBe(DESIGN_PROMPT);
    expect(stagePromptFor('specs')).toBe(DESIGN_PROMPT);
    expect(stagePromptFor('artifacts')).toBe(DESIGN_PROMPT);
  });

  it('gives the Tasks stage to stories', () => {
    expect(stagePromptFor('stories')).toBe(TASKS_PROMPT);
  });

  it('returns nothing for a phase that is not inside a stage', () => {
    // The constitution has its own prompt; the handoff is an export rather than a document under
    // review. Neither should silently inherit a stage prompt.
    expect(stagePromptFor('constitution')).toBeNull();
    expect(stagePromptFor('handoff')).toBeNull();
  });

  it('returns nothing for an id it does not know', () => {
    expect(stagePromptFor('not-a-phase')).toBeNull();
  });
});
