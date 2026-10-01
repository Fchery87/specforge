import { describe, expect, it } from 'vitest';
import { buildStageReport, countWords, stageQualityFlagFor, type StageDocument } from '../stage-report';
import { parseClaimManifest, type ParsedClaim } from '../../claims';
import { mergeSectionContent } from '../../llm/chunking';
import { sectionsFor } from '../../specification/phase-sections';
import { PRD_SECTIONS } from './prd-plan-fixture';

/** A claim bullet in the shape `formatClaimManifest` writes, so the real parser reads it. */
function claimLine(claimId: string, decision: string, review: string, evidence = true): string {
  return `- **${claimId}** [${decision}; ${review}]: A requirement. ${
    evidence ? '— Evidence: lib/authz.ts (4f2a91c, supports)' : '— Evidence not captured'
  }`;
}

function claimsFrom(markdown: string): ParsedClaim[] {
  return parseClaimManifest(markdown);
}

/**
 * A document the way the generator writes one: level-2 headings from `mergeSectionContent`, which is
 * the same function the worker uses, so a heading the report cannot match would be a real defect
 * rather than a bad fixture.
 */
function documentFrom(sections: Array<{ name: string; content: string }>): string {
  return mergeSectionContent(sections);
}

/** One phase document, the unit a plan section is matched inside. */
function doc(phaseId: string, markdown: string): StageDocument {
  return { phaseId, markdown };
}

/** A prose block of an exact word count, so word-count assertions can be exact. */
function padding(count: number): string {
  return Array.from({ length: count }, () => 'word').join(' ');
}

describe('countWords', () => {
  it('counts whitespace-separated tokens', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('  spaced   out \n\n across lines ')).toBe(4);
  });

  it('is zero for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t  ')).toBe(0);
  });
});

describe('buildStageReport traceability', () => {
  it('counts a claim with evidence as traced and one without as untraced', () => {
    const claims = claimsFrom(
      [
        claimLine('C-014', 'confirmed', 'reviewed', true),
        claimLine('C-015', 'proposed', 'reviewed', true),
        claimLine('C-016', 'unresolved', 'pending', false),
      ].join('\n')
    );

    const report = buildStageReport({ documents: [], claims, sectionPlan: [] });

    expect(report.traceability).toEqual({ total: 3, traced: 2, untraced: 1 });
  });

  it('reports untraced for a claim flagged needs_review, the vocabulary the app writes', () => {
    // The review status the app actually stores. A claim with evidence but an unsettled review is
    // traced, and one with no evidence is not, whatever its decision says.
    const claims = claimsFrom(
      [claimLine('C-1', 'confirmed', 'needs_review', true), claimLine('C-2', 'confirmed', 'current', false)].join('\n')
    );

    const report = buildStageReport({ documents: [], claims, sectionPlan: [] });

    expect(report.traceability).toEqual({ total: 2, traced: 1, untraced: 1 });
  });

  it('reports counts of zero rather than a percentage when there are no claims', () => {
    // The documented rule: a project with no claim records reports nothing rather than a fabricated
    // trace rate, so there is no percentage here to fabricate.
    const report = buildStageReport({ documents: [doc('brief', '# Brief\n\nProse.')], claims: [], sectionPlan: [] });

    expect(report.traceability).toEqual({ total: 0, traced: 0, untraced: 0 });
    expect(JSON.stringify(report.traceability)).not.toContain('%');
  });
});

describe('buildStageReport testability', () => {
  it('counts one per class, with an unclassed criterion as unclassified', () => {
    const report = buildStageReport({
      documents: [],
      claims: [],
      sectionPlan: [],
      criteria: ['Returns 204.', 'Should be fast.', 'Handle edge cases.', 'A criterion from before the class existed.'],
      criterionClassList: ['observable', 'unobservable', 'vague'],
    });

    expect(report.testability).toEqual({
      total: 4,
      observable: 1,
      unobservable: 1,
      vague: 1,
      unclassified: 1,
    });
  });

  it('reports every criterion unclassified when none was ever classed', () => {
    const report = buildStageReport({
      documents: [],
      claims: [],
      sectionPlan: [],
      criteria: ['Returns 204.', 'Should be fast.'],
    });

    expect(report.testability).toEqual({
      total: 2,
      observable: 0,
      unobservable: 0,
      vague: 0,
      unclassified: 2,
    });
  });

  it('does not shift classes when the stored list is the wrong length', () => {
    // The normalisation belongs to `criterionClasses` and is exercised there; this asserts the report
    // inherits it rather than re-deriving the pairing.
    const report = buildStageReport({
      documents: [],
      claims: [],
      sectionPlan: [],
      criteria: ['a', 'b', 'c'],
      criterionClassList: ['observable'],
    });

    expect(report.testability).toEqual({
      total: 3,
      observable: 1,
      unobservable: 0,
      vague: 0,
      unclassified: 2,
    });
  });

  it('reports nothing to test when the stage produced no criteria', () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: PRD_SECTIONS });

    expect(report.testability.total).toBe(0);
  });
});

describe('buildStageReport coverage', () => {
  const plan = PRD_SECTIONS;

  it('matches sections written by the same function the generator uses', () => {
    // If this fails, the report cannot see a section the product wrote, which is the one way coverage
    // would silently read zero for everything.
    const markdown = documentFrom([
      { name: 'executive-summary', content: 'Overview.' },
      { name: 'requirements', content: claimLine('C-1', 'confirmed', 'reviewed') },
    ]);

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: plan });

    expect(report.coverage.sections).toBe(2);
  });

  it('counts a present section with no claim as empty', () => {
    const markdown = documentFrom([
      { name: 'executive-summary', content: 'Prose but no requirement.' },
      { name: 'requirements', content: claimLine('C-1', 'confirmed', 'reviewed') },
    ]);

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: plan });

    expect(report.coverage.sections).toBe(2);
    expect(report.coverage.emptySections).toBe(1);
  });

  it('counts a present section with no content at all as empty', () => {
    const markdown = documentFrom([{ name: 'executive-summary', content: '' }]);

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: plan });

    expect(report.coverage.sections).toBe(1);
    expect(report.coverage.emptySections).toBe(1);
  });

  it('names the required sections that are absent, and counts only required ones', () => {
    const markdown = documentFrom([{ name: 'executive-summary', content: claimLine('C-1', 'confirmed', 'reviewed') }]);
    const required = plan.filter((entry) => entry.required).map((entry) => entry.id);
    const optional = plan.filter((entry) => !entry.required).map((entry) => entry.id);

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: plan });

    // Every required section except the one present is missing.
    expect(report.coverage.missingSections).toBe(required.length - 1);
    for (const id of optional) expect(report.coverage.missingSectionIds).not.toContain(id);
    expect(report.coverage.missingSectionIds).not.toContain('executive-summary');
  });

  it('reports every plan section missing for an empty document', () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: plan });

    expect(report.coverage).toEqual({
      sections: 0,
      emptySections: 0,
      missingSections: plan.filter((entry) => entry.required).length,
      missingSectionIds: plan.filter((entry) => entry.required).map((entry) => entry.id),
    });
  });

  it('invents no sections for a plan the document does not follow', () => {
    const report = buildStageReport({
      documents: [doc('prd', '# Something else entirely\n\nProse.')],
      claims: [],
      sectionPlan: plan,
    });

    expect(report.coverage.sections).toBe(0);
  });
});

/**
 * A plan section's claims are counted over its subtree. `parseSpecOutline` ends a body at the next
 * heading of any level, so counting only the own body reported a section as empty while its claim sat
 * under a sub-heading — the most likely false gap in the report, since generated sections carry
 * sub-headings often.
 */
describe('buildStageReport coverage of a section with sub-headings', () => {
  const plan = PRD_SECTIONS;

  it('counts a claim under a nested heading as the parent section\'s', () => {
    const markdown = `## Requirements\n\n### Functional\n\n${claimLine('C-1', 'confirmed', 'reviewed')}\n`;

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: plan });

    expect(report.coverage.sections).toBe(1);
    expect(report.coverage.emptySections).toBe(0);
  });

  it('still counts a section whose only content is prose as empty', () => {
    const markdown = `## Requirements\n\n### Functional\n\nProse, no requirement.\n`;

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: plan });

    expect(report.coverage.emptySections).toBe(1);
  });

  it('does not treat a nested heading as another plan section', () => {
    // "Success Metrics" is a plan section. Nested inside Requirements, it must not be counted twice.
    const markdown = [
      '## Requirements',
      '',
      claimLine('C-1', 'confirmed', 'reviewed'),
      '',
      '### Success Metrics',
      '',
      claimLine('C-2', 'confirmed', 'reviewed'),
    ].join('\n');

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: plan });

    expect(report.coverage.sections).toBe(1);
    expect(report.coverage.emptySections).toBe(0);
  });

  it('sees every section of every real plan, written the way the generator writes them', () => {
    // The invariant that matters: the report must be able to see every section the product produces,
    // or coverage reads zero for everything and no test would notice.
    for (const phaseId of ['constitution', 'brief', 'prd', 'domainModel', 'specs', 'stories', 'artifacts', 'handoff']) {
      const phasePlan = sectionsFor(phaseId);
      if (phasePlan.length === 0) continue;

      const markdown = documentFrom(phasePlan.map((entry) => ({ name: entry.id, content: 'x' })));
      const report = buildStageReport({ documents: [doc(phaseId, markdown)], claims: [], sectionPlan: phasePlan });

      expect(report.coverage.sections).toBe(phasePlan.length);
      expect(report.coverage.missingSectionIds).toEqual([]);
    }
  });

  it('matches a section written with the plan title rather than the id', () => {
    // Titles and ids differ: the PRD's second section is id `problem-statement`, title "Problem
    // Statement". A caller writing titles must still match.
    const markdown = documentFrom(PRD_SECTIONS.map((entry) => ({ name: entry.title, content: 'x' })));

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: PRD_SECTIONS });

    expect(report.coverage.sections).toBe(PRD_SECTIONS.length);
  });
});

/**
 * A stage spans up to three phases and the reading surface renders one phase's document alone, so a
 * plan section is matched inside its own phase's document. Matching the stage's joined text instead
 * recorded anchors of a document nobody renders whenever a heading repeated across artifacts, and
 * let one phase's headings satisfy another phase's plan.
 */
describe('buildStageReport matching inside one phase document', () => {
  it('records the anchor the section document produces, not the joined parse\'s suffixed one', () => {
    // The brief document carries a heading only the prd plan knows. Joined, it anchors first and
    // pushes the prd document's own heading to a suffixed anchor the artifact never renders.
    const briefDocument = [
      '# Atlas brief',
      '',
      '## Problem Statement',
      '',
      'The brief names the problem the prd plan also has a section for.',
    ].join('\n');
    const prdDocument = [
      '# Atlas product requirements',
      '',
      '## Problem Statement',
      '',
      'Requirements written before their evidence is captured drift.',
    ].join('\n');

    const report = buildStageReport({
      documents: [doc('brief', briefDocument), doc('prd', prdDocument)],
      claims: [],
      sectionPlan: [...sectionsFor('brief'), ...PRD_SECTIONS],
    });

    const problem = report.sections.find((entry) => entry.id === 'problem-statement');
    expect(problem?.phaseId).toBe('prd');
    expect(problem?.present).toBe(true);
    // The prd document alone anchors this heading unsuffixed; the joined parse would call it
    // `problem-statement-2`, a heading the rendered artifact does not have.
    expect(problem?.headingKey).toBe('problem-statement');
    expect(problem?.words).toBe(
      countWords('Requirements written before their evidence is captured drift.')
    );
    // The brief's same-named heading neither credits the prd section nor matches the brief's plan.
    expect(
      report.sections.filter((entry) => entry.phaseId === 'brief').every((entry) => !entry.present)
    ).toBe(true);
    expect(report.coverage.sections).toBe(1);
  });

  it('sums duplicate headings in one document and keeps the first occurrence as the mark', () => {
    const withClaim = `${claimLine('C-1', 'confirmed', 'reviewed')}\n\n${padding(1200)}`;
    const withoutClaim = padding(1200);
    const markdown = [
      '## Requirements',
      '',
      withClaim,
      '',
      '## Requirements',
      '',
      withoutClaim,
    ].join('\n');

    const report = buildStageReport({
      documents: [doc('prd', markdown)],
      claims: [],
      sectionPlan: PRD_SECTIONS,
    });

    const requirements = report.sections.find((entry) => entry.id === 'requirements');
    // The words exist both times, so the budget judgement reads the sum: either occurrence alone
    // sits under the 2000-word over-budget line and the two together are past it.
    expect(requirements?.words).toBe(countWords(withClaim) + countWords(withoutClaim));
    expect(requirements?.overBudget).toBe(true);
    // The claim the first occurrence carries must not be lost to the second one.
    expect(requirements?.empty).toBe(false);
    // One mark on the first occurrence is one mark too few rather than one per duplicate.
    expect(requirements?.headingKey).toBe('requirements');
  });

  it('reports a plan section missing when its phase has no document at all', () => {
    // The requirements stage spans brief and prd; only the prd artifact exists, and nothing in its
    // text may stand in for the brief's sections.
    const prdDocument = documentFrom([
      { name: 'requirements', content: claimLine('C-1', 'confirmed', 'reviewed') },
    ]);

    const report = buildStageReport({
      documents: [doc('prd', prdDocument)],
      claims: [],
      sectionPlan: [...sectionsFor('brief'), ...PRD_SECTIONS],
    });

    const briefSections = report.sections.filter((entry) => entry.phaseId === 'brief');
    expect(briefSections.length).toBeGreaterThan(0);
    for (const section of briefSections) {
      expect(section.present).toBe(false);
      expect(section.headingKey).toBeNull();
      expect(section.overBudget).toBe(false);
    }
    expect(report.coverage.missingSectionIds).toContain('problem-and-objectives');
  });
});

describe('buildStageReport length', () => {
  it('compares the word count with the plan estimate converted to words', () => {
    const words = Array.from({ length: 500 }, () => 'word').join(' ');
    const report = buildStageReport({
      documents: [doc('prd', words)],
      claims: [],
      sectionPlan: [{ id: 'a', title: 'A', description: '', estimatedTokens: 1000, required: true, phaseId: 'prd', sectionType: 'documentation' }],
    });

    // 1000 tokens is about 667 words, so 500 is comfortably inside it.
    expect(report.length.words).toBe(500);
    expect(report.length.budgetWords).toBe(667);
    expect(report.length.overBudget).toBe(false);
  });

  it('flags a document past the budget and its tolerance', () => {
    const words = Array.from({ length: 1000 }, () => 'word').join(' ');
    const report = buildStageReport({
      documents: [doc('prd', words)],
      claims: [],
      sectionPlan: [{ id: 'a', title: 'A', description: '', estimatedTokens: 500, required: true, phaseId: 'prd', sectionType: 'documentation' }],
    });

    expect(report.length.words).toBe(1000);
    expect(report.length.budgetWords).toBe(333);
    expect(report.length.overBudget).toBe(true);
  });

  it('does not flag a document within the tolerance', () => {
    const report = buildStageReport({
      documents: [doc('prd', Array.from({ length: 700 }, () => 'word').join(' '))],
      claims: [],
      sectionPlan: [{ id: 'a', title: 'A', description: '', estimatedTokens: 1000, required: true, phaseId: 'prd', sectionType: 'documentation' }],
    });

    // 700 words against a 667-word budget is 5 percent over, inside the 20 percent tolerance.
    expect(report.length.overBudget).toBe(false);
  });

  it('sums the whole plan, so a stage budget is not one phase of it', () => {
    const prd = sectionsFor('prd');
    const tokens = prd.reduce((total, entry) => total + entry.estimatedTokens, 0);

    const report = buildStageReport({ documents: [], claims: [], sectionPlan: prd });

    expect(report.length.budgetWords).toBe(Math.round(tokens * (4 / 6)));
  });
});

describe('buildStageReport shape', () => {
  it('reports the four dimensions separately and combines nothing', () => {
    const report = buildStageReport({
      documents: [doc('prd', documentFrom([{ name: 'requirements', content: claimLine('C-1', 'confirmed', 'reviewed') }]))],
      claims: claimsFrom(claimLine('C-1', 'confirmed', 'reviewed')),
      sectionPlan: PRD_SECTIONS,
      criteria: ['Returns 204.'],
      criterionClassList: ['observable'],
    });

    expect(Object.keys(report).sort()).toEqual([
      'coverage',
      'length',
      'sections',
      'testability',
      'traceability',
    ]);

    // No blended total anywhere: a single score is the thing the spec forbids.
    const flat = JSON.stringify(report);
    expect(flat).not.toContain('score');
    expect(flat).not.toContain('totalScore');
    expect(flat).not.toContain('overall');
  });

  it('is pure, so the same input yields the same report every time', () => {
    const input = {
      documents: [doc('prd', documentFrom([{ name: 'requirements', content: claimLine('C-1', 'confirmed', 'reviewed') }]))],
      claims: claimsFrom(claimLine('C-1', 'confirmed', 'reviewed')),
      sectionPlan: PRD_SECTIONS,
    };

    expect(buildStageReport(input)).toEqual(buildStageReport(input));
  });
});

/**
 * Per-section detail exists so an over-budget or empty section can be marked **where it is**. A
 * stage-level word count cannot do that, which is why these are separate from the `length` summary.
 */
describe('buildStageReport sections detail', () => {
  it('has one entry per plan section, in plan order', () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: PRD_SECTIONS });

    expect(report.sections.map((section) => section.id)).toEqual(
      PRD_SECTIONS.map((section) => section.id)
    );
  });

  it('reports an absent section as not present, with no words and not over budget', () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: PRD_SECTIONS });

    for (const section of report.sections) {
      expect(section.present).toBe(false);
      expect(section.headingKey).toBeNull();
      expect(section.empty).toBe(false);
      expect(section.words).toBe(0);
      expect(section.overBudget).toBe(false);
    }
  });

  it('gives a present section its heading key, so a caller can mark that heading', () => {
    const markdown = documentFrom([{ name: 'requirements', content: claimLine('C-1', 'confirmed', 'reviewed') }]);
    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: PRD_SECTIONS });

    const requirements = report.sections.find((section) => section.id === 'requirements');
    expect(requirements?.present).toBe(true);
    expect(requirements?.headingKey).toBe('requirements');
  });

  it('flags a present section with no claim as empty', () => {
    const markdown = documentFrom([
      { name: 'requirements', content: 'Prose but no requirement.' },
      { name: 'executive-summary', content: claimLine('C-1', 'confirmed', 'reviewed') },
    ]);
    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: PRD_SECTIONS });

    const requirements = report.sections.find((section) => section.id === 'requirements');
    const summary = report.sections.find((section) => section.id === 'executive-summary');

    expect(requirements?.empty).toBe(true);
    expect(summary?.empty).toBe(false);
  });

  it('flags a section past its own budget, not the stage budget', () => {
    // The PRD's second section is budgeted 1500 tokens, about 1000 words. 1500 words is 50 percent
    // past it while the document as a whole is nowhere near the stage budget, which is the distinction
    // that makes a per-section mark worth having. 1200 would sit exactly on the 20 percent tolerance
    // and correctly not be flagged.
    const long = Array.from({ length: 1500 }, () => 'word').join(' ');
    const markdown = documentFrom([{ name: 'problem-statement', content: long }]);
    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: PRD_SECTIONS });

    const section = report.sections.find((entry) => entry.id === 'problem-statement');
    expect(section?.words).toBe(1500);
    expect(section?.budgetWords).toBe(1000);
    expect(section?.overBudget).toBe(true);

    // The stage as a whole is not over: its budget is far larger than one section's.
    expect(report.length.overBudget).toBe(false);
  });

  it('does not flag a section inside its tolerance', () => {
    const long = Array.from({ length: 1150 }, () => 'word').join(' ');
    const markdown = documentFrom([{ name: 'problem-statement', content: long }]);
    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: PRD_SECTIONS });

    const section = report.sections.find((entry) => entry.id === 'problem-statement');
    expect(section?.overBudget).toBe(false);
  });

  it('counts a section budget from the plan, using the same conversion as the stage budget', () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: PRD_SECTIONS });

    for (const [index, plan] of PRD_SECTIONS.entries()) {
      expect(report.sections[index].budgetWords).toBe(
        Math.round(plan.estimatedTokens * (4 / 6))
      );
    }
  });

  /**
   * A numbered heading anchors as the slug of its whole text, so `## 1. Scope` is `1-scope` while
   * `section.title` is `Scope`. Matching on the title slug alone found nothing for a numbered
   * document, and recording the title slug made `headingKey` a key the rendered document has no
   * heading for, so `applySectionMarks` never placed anything.
   */
  it('matches a numbered heading and records its anchor id', () => {
    const markdown = [
      '## 1. Executive Summary',
      '',
      'Overview.',
      '',
      '## 5. Requirements',
      '',
      claimLine('C-1', 'confirmed', 'reviewed'),
    ].join('\n');

    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: PRD_SECTIONS });

    expect(report.coverage.sections).toBe(2);
    expect(report.sections.find((entry) => entry.id === 'executive-summary')?.headingKey).toBe(
      '1-executive-summary'
    );
    expect(report.sections.find((entry) => entry.id === 'requirements')?.headingKey).toBe(
      '5-requirements'
    );
  });

  it('still matches an unnumbered heading by its title, which is what a generated document writes', () => {
    const markdown = documentFrom([{ name: 'executive-summary', content: 'Overview.' }]);
    const report = buildStageReport({ documents: [doc('prd', markdown)], claims: [], sectionPlan: PRD_SECTIONS });

    expect(report.sections.find((entry) => entry.id === 'executive-summary')?.headingKey).toBe(
      'executive-summary'
    );
  });

  /**
   * A stage spans up to three phases and is measured from their texts joined. Without the phase on
   * the section, a caller cannot tell which artifact a section belongs to, so a same-named heading in
   * a sibling phase could be marked in the wrong document.
   */
  it('carries the phase each section belongs to', () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: PRD_SECTIONS });

    for (const [index, plan] of PRD_SECTIONS.entries()) {
      expect(report.sections[index].phaseId).toBe(plan.phaseId);
    }
    expect(report.sections.every((entry) => entry.phaseId === 'prd')).toBe(true);
  });
});

/**
 * The mark a stage earns in the workflow map. It is a projection of the same report the artifact
 * shows, which is the only reason the map's word and the document's lines cannot disagree.
 */
describe('stageQualityFlagFor', () => {
  it('projects the untraced and untestable counts off the report', () => {
    const report = buildStageReport({
      documents: [],
      claims: claimsFrom(
        [
          claimLine('C-1', 'confirmed', 'reviewed', false),
          claimLine('C-2', 'confirmed', 'reviewed', true),
        ].join('\n')
      ),
      sectionPlan: [],
      criteria: ['Returns 204.', 'Should be fast.', 'Handle edge cases.'],
      criterionClassList: ['observable', 'unobservable', 'vague'],
    });

    expect(stageQualityFlagFor(report)).toEqual({ untraced: 1, unobservable: 1, vague: 1 });
  });

  /**
   * A criterion written before the class existed was never judged, so counting it here would call it
   * untestable and relabel it retroactively. The stage stays unmarked.
   */
  it('does not count an unclassified criterion as untestable', () => {
    const report = buildStageReport({
      documents: [],
      claims: [],
      sectionPlan: [],
      criteria: ['A criterion from before the class existed.'],
    });

    expect(report.testability.unclassified).toBe(1);
    expect(stageQualityFlagFor(report)).toEqual({ untraced: 0, unobservable: 0, vague: 0 });
  });

  it('reports zeros for a stage nothing was measured for', () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: [] });

    expect(stageQualityFlagFor(report)).toEqual({ untraced: 0, unobservable: 0, vague: 0 });
  });
});
