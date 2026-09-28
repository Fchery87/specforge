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

  it('writes each applied change to changes/ under its ID and title', () => {
    const entries = buildProjectZipEntries({
      project: { _id: 'p1', title: 'Ledger', description: 'Shared ledger', _creationTime: 1700000000000 },
      artifacts: [],
      claims: [],
      changes: [
        {
          changeNumber: 3,
          kind: 'bugfix',
          title: 'Invite links show a 404!',
          summary: 'Opening an invite link shows a 404.',
          appliedAt: Date.UTC(2026, 8, 27),
          ops: [
            { reason: 'Catches the 404.', claimId: 'REQ-0015', phaseId: 'stories', op: { type: 'add', phaseId: 'stories', kind: 'acceptance_criterion', text: 'Given a link, when opened, then the invite loads.' } },
          ],
        },
      ],
    });

    const change = entries.find((entry) => entry.path === 'changes/CHG-0003-invite-links-show-a-404.md');
    expect(change?.content).toContain('### Added REQ-0015 (Tasks)');
    expect(change?.content).toContain('Given a link, when opened, then the invite loads.');
  });
});

