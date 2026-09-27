import { describe, expect, it } from 'vitest';
import { generateAgentsMd } from '../agents-formatter';
import type { StageQualityForExport } from '../../quality/stage-report';

/**
 * Written out field by field rather than derived, so a drift in the report shape fails here instead
 * of silently rendering wrong numbers into the pack.
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

describe('generateAgentsMd', () => {
  it('groups decisionRegister by status and asserts proposed decisions do not appear under Rules', () => {
    const constitutionData = {
      decisionRegister: [
        {
          area: 'State Management',
          decision: 'Use Convex reactive queries for all shared state',
          status: 'confirmed',
          source: 'architecture-review',
          rationale: 'Consistency and real-time sync',
        },
        {
          area: 'Monorepo Tooling',
          decision: 'Repository currently uses Turborepo with npm workspaces',
          status: 'observed',
          source: 'repo-scan',
          rationale: 'Observed in package.json',
        },
        {
          area: 'Component Library',
          decision: 'Adopt Radix Primitives for custom dropdowns',
          status: 'proposed',
          source: 'design-proposal',
          rationale: 'Better a11y support',
        },
        {
          area: 'Telemetry',
          decision: 'Decide whether to use PostHog or OpenTelemetry',
          status: 'unresolved',
          source: 'brief',
          rationale: 'Need cloud budget approval',
        },
      ],
      openQuestions: ['What is the target maximum p99 latency for search?'],
    };

    const output = generateAgentsMd({
      project: {
        _id: 'p1',
        title: 'SpecForge Platform',
        description: 'AI Specification Generator',
        createdAt: 1700000000000,
      },
      artifacts: {
        constitution: JSON.stringify(constitutionData),
      },
    });

    expect(output).toContain('## Rules');
    expect(output).toContain('## Observed in the repository');
    expect(output).toContain('## Proposed, not confirmed');
    expect(output).toContain('## Open questions');

    // Extract section under '## Rules'
    const rulesIndex = output.indexOf('## Rules');
    const observedIndex = output.indexOf('## Observed in the repository');
    const rulesSection = output.slice(rulesIndex, observedIndex);

    expect(rulesSection).toContain('Use Convex reactive queries for all shared state');
    expect(rulesSection).not.toContain('Adopt Radix Primitives for custom dropdowns');

    // Extract section under '## Observed in the repository'
    const proposedIndex = output.indexOf('## Proposed, not confirmed');
    const observedSection = output.slice(observedIndex, proposedIndex);
    expect(observedSection).toContain('Repository currently uses Turborepo with npm workspaces');

    // Extract section under '## Proposed, not confirmed'
    const openQuestionsIndex = output.indexOf('## Open questions');
    const proposedSection = output.slice(proposedIndex, openQuestionsIndex);
    expect(proposedSection).toContain('Adopt Radix Primitives for custom dropdowns');

    // Extract section under '## Open questions'
    const afterQuestions = output.slice(openQuestionsIndex);
    expect(afterQuestions).toContain('Decide whether to use PostHog or OpenTelemetry');
    expect(afterQuestions).toContain('What is the target maximum p99 latency for search?');
  });
});

describe('generateAgentsMd requirement quality', () => {
  it('writes the report lines and lists the untestable criteria under their own heading', () => {
    const output = generateAgentsMd({
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

    // The criteria sit under their own heading, after the stage's counts, where an agent can act on
    // them as a list.
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

    // The report belongs before the closing boilerplate, not after it.
    expect(output.indexOf('## Requirement quality')).toBeLessThan(
      output.indexOf('## Getting Help')
    );
  });

  it('skips a stage whose report has nothing to act on, and the heading when every stage is', () => {
    const allUnmeasured = generateAgentsMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: [unmeasuredStage],
    });

    expect(allUnmeasured).not.toContain('## Requirement quality');
    expect(allUnmeasured).not.toContain('### Design');

    const mixed = generateAgentsMd({
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

    const output = generateAgentsMd({
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
    const withoutField = generateAgentsMd({ project: baseProject, artifacts: {} });
    const withUndefined = generateAgentsMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: undefined,
    });
    const withEmpty = generateAgentsMd({
      project: baseProject,
      artifacts: {},
      requirementQuality: [],
    });

    expect(withUndefined).toBe(withoutField);
    expect(withEmpty).toBe(withoutField);
  });
});
