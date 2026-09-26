import { describe, expect, it } from 'vitest';
import { buildProjectZipEntries } from '../actions/generateProjectZip';

describe('buildProjectZipEntries', () => {
  it('asserts CLAUDE.md has content @AGENTS.md\\n and no path starts with .cursor', () => {
    const entries = buildProjectZipEntries({
      project: {
        _id: 'p1',
        title: 'SpecForge Demo',
        description: 'Test Project',
        _creationTime: 1700000000000,
      },
      artifacts: [
        {
          phaseId: 'brief',
          title: 'Project Brief',
          content: '# Brief\nDetails here.',
        },
        {
          phaseId: 'constitution',
          title: 'Project Constitution',
          content: JSON.stringify({
            decisionRegister: [
              {
                area: 'Backend',
                decision: 'Use Convex',
                status: 'confirmed',
                source: 'brief',
                rationale: 'Fast sync',
              },
            ],
          }),
        },
      ],
      claims: [],
    });

    const claudeEntry = entries.find((e) => e.path === 'CLAUDE.md');
    expect(claudeEntry).toBeDefined();
    expect(claudeEntry?.content).toBe('@AGENTS.md\n');

    const agentsEntry = entries.find((e) => e.path === 'AGENTS.md');
    expect(agentsEntry).toBeDefined();

    const cursorEntries = entries.filter((e) => e.path.startsWith('.cursor'));
    expect(cursorEntries).toHaveLength(0);
  });
});
