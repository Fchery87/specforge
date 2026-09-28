import { describe, expect, it } from 'vitest';
import { DIFF_BUDGET_CHARS, SKIP_REASONS } from '../budget';
import type { DiffFile } from '../diff';
import { ReplyOutOfRoom, runCheck, UNUSABLE_REPLY, type CheckInput } from '../run-check';

const invitations: DiffFile = {
  path: 'convex/invitations.ts',
  status: 'modified',
  additions: 2,
  deletions: 1,
  patch: '@@ -10,3 +10,4 @@\n   const day = 24 * 60 * 60 * 1000;\n-  return issuedAt + day;\n+  const lifetimeDays = 7;\n+  return issuedAt + lifetimeDays * day;\n }',
};

function input(overrides: Partial<CheckInput['change']> = {}, model = { contextTokens: 128_000, maxOutputTokens: 8_000 }): CheckInput {
  return {
    projectTitle: 'Team ledger',
    change: {
      source: { kind: 'pull_request', number: 12, title: 'Longer invitations', url: 'https://github.com/o/r/pull/12', baseSha: 'b', headSha: 'h' },
      title: 'Longer invitations',
      body: 'Implements REQ-0003.',
      commitMessages: ['feat: invitations last longer'],
      files: [invitations],
      notes: [],
      ...overrides,
    },
    claims: [
      { claimId: 'REQ-0003', text: 'An invitation is valid for fourteen days.', decisionStatus: 'confirmed', retired: false },
      { claimId: 'REQ-0007', text: 'Entries are never edited in place.', decisionStatus: 'proposed', retired: false },
    ],
    changes: [],
    model,
  };
}

const violation = JSON.stringify({
  verdicts: [
    {
      requirement: 'REQ-0003',
      verdict: 'violated',
      explanation: 'Seven days, not fourteen.',
      evidence: [{ path: 'convex/invitations.ts', quote: 'const lifetimeDays = 7;' }],
    },
  ],
});

describe('runCheck', () => {
  it('checks the cited requirement and grades the verdict by the table', async () => {
    const prompts: string[] = [];
    const outcome = await runCheck(input(), async (prompt) => {
      prompts.push(prompt);
      return violation;
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('- REQ-0003: An invitation is valid for fourteen days.');
    expect(prompts[0]).not.toContain('REQ-0007');
    expect(outcome).toEqual({
      source: input().change.source,
      verdicts: [
        {
          claimId: 'REQ-0003',
          scope: 'cited',
          verdict: 'violated',
          severity: 'critical',
          explanation: 'Seven days, not fourteen.',
          evidence: [{ path: 'convex/invitations.ts', line: 11, quote: 'const lifetimeDays = 7;' }],
        },
      ],
      otherFindings: [],
      coverage: { reviewedFiles: ['convex/invitations.ts'], skippedFiles: [] },
      notes: [],
      status: 'fail',
      overallScore: 75,
    });
  });

  it('offers every live requirement when nothing is cited, as a pasted diff never cites', async () => {
    const pasted = input({ source: { kind: 'pasted' }, title: '', body: '', commitMessages: [] });
    const prompts: string[] = [];
    const outcome = await runCheck(pasted, async (prompt) => {
      prompts.push(prompt);
      return violation;
    });

    expect(prompts[0]).toContain('The change cites no requirement.');
    expect(prompts[0]).toContain('- REQ-0007: Entries are never edited in place.');
    expect(prompts[0]).not.toContain('## Pull request');
    expect(outcome.verdicts[0]).toMatchObject({ claimId: 'REQ-0003', scope: 'inferred', severity: 'critical' });
  });

  it('reads a diff far past the fixed budget whole on a 1,000,000-token model', async () => {
    const lines = Array.from({ length: 4_000 }, (_, index) => `+  const setting${index} = ${index}; // configuration value`);
    const large: DiffFile = { path: 'lib/settings.ts', status: 'added', additions: 4_000, deletions: 0, patch: `@@ -0,0 +1,4000 @@\n${lines.join('\n')}` };
    expect(large.patch!.length).toBeGreaterThan(DIFF_BUDGET_CHARS * 3);

    const prompts: string[] = [];
    const outcome = await runCheck(input({ files: [invitations, large] }, { contextTokens: 1_000_000, maxOutputTokens: 32_000 }), async (prompt) => {
      prompts.push(prompt);
      return violation;
    });

    expect(outcome.coverage).toEqual({ reviewedFiles: ['convex/invitations.ts', 'lib/settings.ts'], skippedFiles: [] });
    expect(prompts[0]).toContain('+  const setting3999 = 3999; // configuration value');
  });

  it('skips what a small model cannot hold, and the skipped file lowers the status to a warning', async () => {
    const met = JSON.stringify({
      verdicts: [{ requirement: 'REQ-0003', verdict: 'met', explanation: 'Fourteen.', evidence: [{ path: 'convex/invitations.ts', quote: 'return issuedAt + lifetimeDays * day;' }] }],
    });
    const lines = Array.from({ length: 2_000 }, (_, index) => `+line ${index} of a long generated table`);
    const large: DiffFile = { path: 'lib/table.ts', status: 'added', additions: 2_000, deletions: 0, patch: `@@ -0,0 +1,2000 @@\n${lines.join('\n')}` };

    const outcome = await runCheck(input({ files: [invitations, large] }, { contextTokens: 16_000, maxOutputTokens: 4_000 }), async () => met);

    expect(outcome.coverage.skippedFiles).toEqual([{ path: 'lib/table.ts', reason: SKIP_REASONS.overBudget }]);
    expect(outcome.status).toBe('warning');
  });

  it('asks once more when the first reply is not JSON', async () => {
    const replies = ['I think it looks fine.', violation];
    const prompts: string[] = [];
    const outcome = await runCheck(input(), async (prompt) => {
      prompts.push(prompt);
      return replies.shift() ?? '';
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('Your last reply was not the JSON object asked for.');
    expect(outcome.verdicts[0].verdict).toBe('violated');
  });

  it('says what to do when the model twice returns no usable reply', async () => {
    let calls = 0;
    await expect(
      runCheck(input(), async () => {
        calls += 1;
        return 'Let me think about each requirement in turn. First, REQ-0003 says';
      }),
    ).rejects.toThrow(UNUSABLE_REPLY);
    expect(calls).toBe(2);
  });

  it('stops without a retry when the model ran out of room, and says how to make the check smaller', async () => {
    let calls = 0;
    await expect(
      runCheck(input(), async () => {
        calls += 1;
        throw new ReplyOutOfRoom();
      }),
    ).rejects.toThrow('Cite the requirements this pull request implements');
    expect(calls).toBe(1);
  });

  it('does not call the model when no file can be read, and says so', async () => {
    let calls = 0;
    const outcome = await runCheck(input({ files: [{ path: 'package-lock.json', status: 'modified', additions: 900, deletions: 800, patch: '@@ -1 +1 @@\n+x' }] }), async () => {
      calls += 1;
      return violation;
    });

    expect(calls).toBe(0);
    expect(outcome.verdicts).toEqual([
      { claimId: 'REQ-0003', scope: 'cited', verdict: 'not_shown', severity: null, explanation: 'No file in this change could be read.', evidence: [] },
    ]);
    expect(outcome.notes).toEqual(['No file in this change could be read, so nothing was judged.']);
    expect(outcome.status).toBe('warning');
  });

  it('refuses a change with no files, and a project with no live requirements', async () => {
    await expect(runCheck(input({ files: [] }), async () => violation)).rejects.toThrow('This change has no changed files to check.');
    const retiredOnly = { ...input(), claims: input().claims.map((claim) => ({ ...claim, retired: true })) };
    await expect(runCheck(retiredOnly, async () => violation)).rejects.toThrow(
      'This project has no requirements to check against yet. Generate its documents first.',
    );
  });
});
