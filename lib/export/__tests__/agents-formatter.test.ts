import { describe, expect, it } from 'vitest';
import { generateAgentsMd } from '../agents-formatter';

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
