import { describe, expect, it } from 'vitest';
import { generateSkillMd } from '../skill-formatter';
import type { StageQualityForExport } from '../../quality/stage-report';

/**
 * Written out field by field rather than derived, so a drift in the report shape fails here instead
 * of silently rendering wrong numbers into the pack. The fixtures mirror the AGENTS.md tests, because
 * both files in the pack must carry the same signal the screen showed.
 */
const measuredStage: StageQualityForExport = {
  stageId: 'requirements',
  stageLabel: 'Requirements',
  traceability: { total: 4, traced: 3, untraced: 1 },
  testability: {
    total: 5,
    observable: 3,
    unobservable: 1,
    vague: 1,
    unclassified: 0,
  },
  coverage: {
    sections: 3,
    emptySections: 1,
    missingSections: 1,
    missingSectionIds: ['risks'],
  },
  length: { words: 900, budgetWords: 800, overBudget: true },
  untestableCriteria: ['Archiving should be fast.', 'Handle edge cases.'],
};

const unmeasuredStage: StageQualityForExport = {
  stageId: 'design',
  stageLabel: 'Design',
  traceability: { total: 0, traced: 0, untraced: 0 },
  testability: {
    total: 0,
    observable: 0,
    unobservable: 0,
    vague: 0,
    unclassified: 0,
  },
  coverage: { sections: 0, emptySections: 0, missingSections: 0, missingSectionIds: [] },
  length: { words: 0, budgetWords: 0, overBudget: false },
  untestableCriteria: [],
};

const baseProject = {
  _id: 'p1',
  title: 'SpecForge Platform',
  description: 'AI Specification Generator',
  createdAt: 1700000000000,
};

describe('generateSkillMd requirement quality', () => {
  it('writes the report lines and lists the untestable criteria under their own heading', () => {
    const output = generateSkillMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: [measuredStage, unmeasuredStage],
    });

    expect(output).toContain('## Requirement quality');
    expect(output).toContain('### Requirements');
    expect(output).toContain('- 3 of 4 requirements traced');
    expect(output).toContain('- 1 untraced');
    expect(output).toContain('- 3 of 5 criteria testable');
    expect(output).toContain('- 1 not observable');
    expect(output).toContain('- 1 vague');
    expect(output).toContain('- 3 of 4 sections present');
    expect(output).toContain('- 1 empty');
    expect(output).toContain('- 1 missing');
    expect(output).toContain('- 900 of 800 words');
    expect(output).toContain('- over budget');

    const stageIndex = output.indexOf('### Requirements');
    const untestableIndex = output.indexOf('### Untestable criteria');
    expect(stageIndex).toBeGreaterThan(-1);
    expect(untestableIndex).toBeGreaterThan(stageIndex);
    expect(untestableIndex).toBeGreaterThan(output.indexOf('- 900 of 800 words'));
    expect(output.slice(untestableIndex)).toContain('- Archiving should be fast.');
    expect(output.slice(untestableIndex)).toContain('- Handle edge cases.');

    // Advisory counts, never a blended score or a percentage.
    expect(output).not.toContain('/100');
    expect(output).not.toContain('%');

    // The report belongs with the guidance body, before the closing walkthrough.
    expect(output.indexOf('## Requirement quality')).toBeLessThan(
      output.indexOf('## Getting Started')
    );
  });

  it('skips a stage whose report has nothing to act on, and the heading when every stage is', () => {
    const allUnmeasured = generateSkillMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: [unmeasuredStage],
    });

    expect(allUnmeasured).not.toContain('## Requirement quality');
    expect(allUnmeasured).not.toContain('### Design');

    const mixed = generateSkillMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: [measuredStage, unmeasuredStage],
    });

    expect(mixed).toContain('### Requirements');
    expect(mixed).not.toContain('### Design');
  });

  it('says nothing about a dimension that is clean, so the pack reads as a to-do list', () => {
    const cleanStage: StageQualityForExport = {
      ...measuredStage,
      traceability: { total: 4, traced: 4, untraced: 0 },
      testability: {
        total: 5,
        observable: 5,
        unobservable: 0,
        vague: 0,
        unclassified: 0,
      },
      coverage: {
        sections: 4,
        emptySections: 0,
        missingSections: 0,
        missingSectionIds: [],
      },
      length: { words: 700, budgetWords: 800, overBudget: false },
      untestableCriteria: [],
    };

    const output = generateSkillMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: [cleanStage],
    });

    expect(output).toContain('### Requirements');
    expect(output).toContain('- 4 of 4 requirements traced');
    // The reading surface suppresses a count of zero, and the pack words it the same way, so an
    // agent reads what to do rather than a list of zeros.
    expect(output).not.toContain('- 0 untraced');
    expect(output).not.toContain('- 0 empty');
    expect(output).not.toContain('- 0 missing');
    expect(output).not.toContain('- over budget');
    expect(output).not.toContain('### Untestable criteria');
  });

  it('leaves the output byte-identical when requirementQuality is absent, undefined or empty', () => {
    const withoutField = generateSkillMd({ project: baseProject, artifacts: {} });
    const withUndefined = generateSkillMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: undefined,
    });
    const withEmpty = generateSkillMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: [],
    });

    expect(withUndefined).toBe(withoutField);
    expect(withEmpty).toBe(withoutField);
  });
});
