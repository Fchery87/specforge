import { describe, expect, it } from 'vitest';
import type { QueryCtx } from '../_generated/server';
import { getCheckContextHandler, getCheckHandler, listChecksHandler } from '../verification';

type FakeRow = Record<string, unknown> & { _id: string };
type FakeIndexQuery = { eq: (field: string, value: unknown) => FakeIndexQuery };

const LEGACY_CHECK = {
  _id: 'vr-legacy',
  projectId: 'p1',
  phaseId: 'specs',
  checkedAt: 100,
  findings: [
    { category: 'bug', severity: 'major', title: 'Missing check', description: '', suggestion: '' },
    { category: 'missing', severity: 'minor', title: 'No test', description: '', suggestion: '' },
  ],
  overallScore: 87,
  status: 'warning',
};
const PR_CHECK = {
  _id: 'vr-pr',
  projectId: 'p1',
  checkedAt: 200,
  findings: [],
  overallScore: 75,
  status: 'fail',
  outdatedAt: 250,
  source: { kind: 'pull_request', number: 12, title: 'Longer invitations', url: 'https://github.com/o/r/pull/12', baseSha: 'b', headSha: 'h' },
  verdicts: [
    { claimId: 'REQ-0003', scope: 'cited', verdict: 'violated', severity: 'critical', explanation: 'Seven days.', evidence: [] },
    { claimId: 'REQ-0004', scope: 'change', verdict: 'met', severity: null, explanation: 'Refused.', evidence: [] },
  ],
  coverage: { reviewedFiles: ['convex/invitations.ts'], skippedFiles: [] },
};

function makeCtx(authUserId: string | null = 'owner') {
  const tables: Record<string, Map<string, FakeRow>> = {
    projects: new Map([['p1', { _id: 'p1', userId: 'owner', title: 'Team ledger' }]]),
    projectCodebase: new Map([
      ['cb1', { _id: 'cb1', projectId: 'p1', repoOwner: 'Fchery87', repoName: 'ledger', repoUrl: 'https://github.com/Fchery87/ledger' }],
    ]),
    claims: new Map([
      ['c3', { _id: 'c3', projectId: 'p1', phaseId: 'prd', claimId: 'REQ-0003', text: 'Valid for fourteen days.', decisionStatus: 'confirmed', reviewStatus: 'current', artifactId: 'prd-doc', artifactVersion: 4 }],
      ['c4', { _id: 'c4', projectId: 'p1', phaseId: 'stories', claimId: 'REQ-0004', text: 'Expired invitations add no member.', decisionStatus: 'proposed', reviewStatus: 'needs_review', artifactId: 'prd-doc', artifactVersion: 4 }],
      ['c9', { _id: 'c9', projectId: 'p1', claimId: 'REQ-0009', text: 'Expires after one day.', decisionStatus: 'confirmed', reviewStatus: 'current', artifactId: 'prd-doc', retiredAt: 50 }],
    ]),
    changes: new Map([
      ['ch1', { _id: 'ch1', projectId: 'p1', changeNumber: 1, status: 'applied' }],
      ['ch2', { _id: 'ch2', projectId: 'p1', changeNumber: 2, status: 'draft' }],
    ]),
    changeOps: new Map([
      ['op1', { _id: 'op1', changeId: 'ch1', op: { type: 'modify', claim: 'c3', baseText: 'x', text: 'y' } }],
      ['op2', { _id: 'op2', changeId: 'ch1', op: { type: 'add', phaseId: 'prd', kind: 'requirement', text: 'z' }, appliedClaim: 'c4' }],
      ['op3', { _id: 'op3', changeId: 'ch1', op: { type: 'remove', claim: 'c9', baseText: 'x' } }],
      ['op4', { _id: 'op4', changeId: 'ch2', op: { type: 'add', phaseId: 'prd', kind: 'requirement', text: 'w' } }],
    ]),
    verificationResults: new Map<string, FakeRow>([
      ['vr-legacy', LEGACY_CHECK],
      ['vr-pr', PR_CHECK],
    ]),
  };
  const findTable = (id: string) => Object.values(tables).find((table) => table.has(id));
  const ctx = {
    auth: { getUserIdentity: async () => (authUserId ? { subject: authUserId } : null) },
    db: {
      get: async (id: string) => findTable(id)?.get(id) ?? null,
      query: (tableName: string) => {
        let predicate = (_row: FakeRow) => true;
        const q = {
          withIndex: (_index: string, apply: (iq: FakeIndexQuery) => unknown) => {
            const conditions: Array<(row: FakeRow) => boolean> = [];
            const iq: FakeIndexQuery = {
              eq: (field, value) => {
                conditions.push((row) => row[field] === value);
                return iq;
              },
            };
            apply(iq);
            predicate = (row) => conditions.every((condition) => condition(row));
            return q;
          },
          collect: async () => [...tables[tableName].values()].filter(predicate),
          first: async () => [...tables[tableName].values()].find(predicate) ?? null,
        };
        return q;
      },
    },
  };
  return { ctx: ctx as unknown as QueryCtx, tables };
}

describe('getCheckContext', () => {
  it('gives every requirement with its retired state, and each change with the requirements it added, reworded or reaffirmed', async () => {
    const { ctx } = makeCtx(null);

    const context = await getCheckContextHandler(ctx, { projectId: 'p1' as never, userId: 'owner' });

    expect(context.projectTitle).toBe('Team ledger');
    expect(context.repository).toEqual({ owner: 'Fchery87', name: 'ledger', url: 'https://github.com/Fchery87/ledger' });
    expect(context.claims.map(({ claimId, retired, decisionStatus }) => ({ claimId, retired, decisionStatus }))).toEqual([
      { claimId: 'REQ-0003', retired: false, decisionStatus: 'confirmed' },
      { claimId: 'REQ-0004', retired: false, decisionStatus: 'proposed' },
      { claimId: 'REQ-0009', retired: true, decisionStatus: 'confirmed' },
    ]);
    expect(context.changes).toEqual([
      { changeId: 'CHG-0001', status: 'applied', claimIds: ['REQ-0003', 'REQ-0004'] },
      { changeId: 'CHG-0002', status: 'draft', claimIds: [] },
    ]);
  });

  it('refuses a user who does not own the project', async () => {
    const { ctx } = makeCtx();
    await expect(getCheckContextHandler(ctx, { projectId: 'p1' as never, userId: 'someone-else' })).rejects.toThrow('Forbidden');
  });
});

describe('listChecks', () => {
  it('lists old and new checks newest first, counting severities from verdicts or findings', async () => {
    const { ctx } = makeCtx();

    expect(await listChecksHandler(ctx, { projectId: 'p1' as never })).toEqual([
      {
        _id: 'vr-pr',
        checkedAt: 200,
        status: 'fail',
        overallScore: 75,
        outdatedAt: 250,
        source: PR_CHECK.source,
        counts: { critical: 1, major: 0, minor: 0 },
      },
      { _id: 'vr-legacy', checkedAt: 100, status: 'warning', overallScore: 87, phaseId: 'specs', counts: { critical: 0, major: 1, minor: 1 } },
    ]);
  });

  it('refuses a signed-out reader', async () => {
    const { ctx } = makeCtx(null);
    await expect(listChecksHandler(ctx, { projectId: 'p1' as never })).rejects.toThrow('Forbidden');
  });
});

describe('getCheck', () => {
  it('returns the check with the current wording of each requirement it judged, and the repository', async () => {
    const { ctx } = makeCtx();

    const result = await getCheckHandler(ctx, { checkId: 'vr-pr' as never });

    expect(result.check).toBe(PR_CHECK);
    expect(result.requirements).toEqual({
      'REQ-0003': { text: 'Valid for fourteen days.', phaseId: 'prd', decisionStatus: 'confirmed', reviewStatus: 'current', retired: false },
      'REQ-0004': { text: 'Expired invitations add no member.', phaseId: 'stories', decisionStatus: 'proposed', reviewStatus: 'needs_review', retired: false },
    });
    expect(result.repositoryUrl).toBe('https://github.com/Fchery87/ledger');
  });

  it("returns an old check without looking up requirements, and refuses another user's check", async () => {
    expect((await getCheckHandler(makeCtx().ctx, { checkId: 'vr-legacy' as never })).requirements).toEqual({});
    await expect(getCheckHandler(makeCtx('someone-else').ctx, { checkId: 'vr-pr' as never })).rejects.toThrow('Forbidden');
  });
});
