import { describe, expect, it } from 'vitest';
import { buildCheckPrompt } from '../check-prompt';
import { splitUnifiedDiff } from '../diff';
import { parseCheck, type ParseCheckContext } from '../parse-check';
import type { ScopedRequirement } from '../scope';

const reviewed = splitUnifiedDiff(
  [
    'diff --git a/convex/invitations.ts b/convex/invitations.ts',
    '--- a/convex/invitations.ts',
    '+++ b/convex/invitations.ts',
    '@@ -10,3 +10,4 @@',
    '   const day = 24 * 60 * 60 * 1000;',
    '-  return issuedAt + day;',
    '+  const lifetimeDays = 7;',
    '+  return issuedAt + lifetimeDays * day;',
    ' }',
    '',
  ].join('\n'),
);

const scope: ScopedRequirement[] = [
  { claimId: 'REQ-0003', text: 'An invitation is valid for fourteen days after it is issued.', decisionStatus: 'confirmed', scope: 'cited' },
  { claimId: 'REQ-0004', text: 'An invitation accepted after it expires adds no member.', decisionStatus: 'proposed', scope: 'change' },
];

const cited: ParseCheckContext = { scope, candidates: [], reviewed };

function reply(body: object): string {
  return `Here is the check:\n\`\`\`json\n${JSON.stringify(body)}\n\`\`\``;
}

describe('parseCheck', () => {
  it('keeps a verdict whose quote is in the diff, grades it by the table, and numbers the line', () => {
    const result = parseCheck(
      reply({
        verdicts: [
          {
            requirement: 'REQ-0003',
            verdict: 'violated',
            explanation: 'The lifetime is set to seven days, not fourteen.',
            evidence: [{ path: 'convex/invitations.ts', quote: '+  const lifetimeDays = 7;' }],
          },
        ],
      }),
      cited,
    );

    expect(result.verdicts).toEqual([
      {
        claimId: 'REQ-0003',
        scope: 'cited',
        verdict: 'violated',
        severity: 'critical',
        explanation: 'The lifetime is set to seven days, not fourteen.',
        evidence: [{ path: 'convex/invitations.ts', line: 11, quote: 'const lifetimeDays = 7;' }],
      },
      {
        claimId: 'REQ-0004',
        scope: 'change',
        verdict: 'not_shown',
        severity: null,
        explanation: 'The check did not report on this requirement.',
        evidence: [],
      },
    ]);
    expect(result.notes).toEqual([]);
  });

  it('drops an invented quote, and a verdict left without evidence counts as not shown', () => {
    const result = parseCheck(
      reply({
        verdicts: [
          {
            requirement: 'REQ-0004',
            verdict: 'violated',
            explanation: 'Expired invitations are still accepted.',
            evidence: [{ path: 'convex/invitations.ts', quote: 'if (expired) return addMember(invite);' }],
          },
        ],
      }),
      cited,
    );

    expect(result.verdicts.find((verdict) => verdict.claimId === 'REQ-0004')).toEqual({
      claimId: 'REQ-0004',
      scope: 'change',
      verdict: 'not_shown',
      severity: null,
      explanation: 'The check gave no line from the diff that supports a verdict.',
      evidence: [],
    });
    expect(result.notes).toEqual([
      '1 quote given for REQ-0004 is not in the diff and was dropped.',
      'REQ-0004 was marked violated without a line from the diff to support it, so it counts as not shown.',
    ]);
  });

  it('requires a quote for met too, and a trivial line does not count', () => {
    const result = parseCheck(
      reply({
        verdicts: [
          { requirement: 'REQ-0003', verdict: 'met', explanation: 'Looks right.', evidence: [] },
          { requirement: 'REQ-0004', verdict: 'met', explanation: 'Closes the function.', evidence: [{ path: 'convex/invitations.ts', quote: '}' }] },
        ],
      }),
      cited,
    );

    expect(result.verdicts.map(({ claimId, verdict }) => ({ claimId, verdict }))).toEqual([
      { claimId: 'REQ-0003', verdict: 'not_shown' },
      { claimId: 'REQ-0004', verdict: 'not_shown' },
    ]);
  });

  it('drops a verdict for a requirement outside the check, and a second verdict for the same one', () => {
    const result = parseCheck(
      reply({
        verdicts: [
          { requirement: 'REQ-0003', verdict: 'incomplete', explanation: 'Partly.', evidence: [{ path: './convex/invitations.ts', quote: 'return issuedAt + lifetimeDays * day;' }] },
          { requirement: 'REQ-0003', verdict: 'met', explanation: 'Again.', evidence: [] },
          { requirement: 'REQ-0042', verdict: 'violated', explanation: 'Invented.', evidence: [] },
        ],
      }),
      cited,
    );

    expect(result.verdicts[0]).toMatchObject({ claimId: 'REQ-0003', verdict: 'incomplete', severity: 'major', evidence: [{ path: 'convex/invitations.ts', line: 12 }] });
    expect(result.notes).toEqual([
      'The check judged REQ-0003 twice; the second verdict was dropped.',
      'The check judged REQ-0042, which is not among the requirements checked, and that verdict was dropped.',
    ]);
  });

  it('with nothing cited, keeps only the candidates the model found touched, marked inferred', () => {
    const result = parseCheck(
      reply({
        verdicts: [
          { requirement: 'REQ-0003', verdict: 'violated', explanation: 'Seven, not fourteen.', evidence: [{ path: 'convex/invitations.ts', quote: 'const lifetimeDays = 7;' }] },
          { requirement: 'REQ-0007', verdict: 'not_shown', explanation: 'Unrelated.', evidence: [] },
        ],
      }),
      {
        scope: [],
        candidates: [
          { claimId: 'REQ-0003', decisionStatus: 'proposed' },
          { claimId: 'REQ-0007', decisionStatus: 'confirmed' },
        ],
        reviewed,
      },
    );

    expect(result.verdicts).toEqual([
      {
        claimId: 'REQ-0003',
        scope: 'inferred',
        verdict: 'violated',
        severity: 'major',
        explanation: 'Seven, not fourteen.',
        evidence: [{ path: 'convex/invitations.ts', line: 11, quote: 'const lifetimeDays = 7;' }],
      },
    ]);
  });

  it('keeps other findings apart, with a path only when the file was reviewed', () => {
    const result = parseCheck(
      reply({
        verdicts: [],
        otherFindings: [
          { category: 'security', title: 'Token logged', description: 'The invite token is written to the log.', path: 'convex/invitations.ts' },
          { category: 'style', title: 'Naming', description: 'Rename it.', path: 'lib/elsewhere.ts' },
          { category: 'bug', description: 'No title.' },
        ],
      }),
      cited,
    );

    expect(result.otherFindings).toEqual([
      { category: 'security', title: 'Token logged', description: 'The invite token is written to the log.', path: 'convex/invitations.ts' },
      { category: 'bug', title: 'Naming', description: 'Rename it.' },
    ]);
  });

  it('refuses a reply with no JSON', () => {
    expect(() => parseCheck('I could not check this.', cited)).toThrow('The check reply held no JSON object');
  });
});

describe('buildCheckPrompt', () => {
  const base = {
    projectTitle: 'Team ledger',
    pullRequest: { title: 'Invitations last fourteen days', body: 'Implements CHG-0002.', commitMessages: ['feat: longer invitations\n\nREQ-0003'] },
    reviewed,
    skipped: [{ path: 'package-lock.json', reason: 'Lockfile' }],
  };

  it('asks for a verdict on every cited requirement and names the files it does not show', () => {
    const prompt = buildCheckPrompt({ ...base, scope, candidates: [] });
    expect(prompt).toContain('Give a verdict for every one of these, by ID.\n- REQ-0003: An invitation is valid for fourteen days after it is issued.');
    expect(prompt).toContain('Commits:\n- feat: longer invitations');
    expect(prompt).toContain('```diff\n@@ -10,3 +10,4 @@');
    expect(prompt).toContain('These files changed but are not shown; do not judge them:\n- package-lock.json');
  });

  it('offers the whole list and asks only for what the diff touches when nothing is cited', () => {
    const prompt = buildCheckPrompt({
      ...base,
      scope: [],
      candidates: Array.from({ length: 152 }, (_, index) => ({ claimId: `REQ-${String(index + 1).padStart(4, '0')}`, text: 'A requirement.' })),
    });
    expect(prompt).toContain('Give a verdict only for the requirements this diff implements, changes or breaks; leave the rest out.');
    expect(prompt).toContain('- REQ-0150: A requirement.');
    expect(prompt).not.toContain('REQ-0151');
    expect(prompt).toContain('(2 more not listed)');
  });
});
