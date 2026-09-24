import { describe, expect, it } from 'vitest';
import type { MutationCtx } from '../_generated/server';
import { captureEvidenceSource, reconcileArtifactClaims } from '../lib/evidence';

type FakeRow = Record<string, unknown> & { _id: string };
type FakeIndexQuery = { eq: (field: string, value: unknown) => FakeIndexQuery };
type FakeContext = {
  auth: { getUserIdentity: () => Promise<{ subject: string }> };
  db: unknown;
  __tables: Record<string, Map<string, FakeRow>>;
};

function makeCtx(): FakeContext {
  const tables: Record<string, Map<string, FakeRow>> = {
    projects: new Map([['p1', { _id: 'p1', userId: 'u1' }]]),
    evidenceSources: new Map(),
    evidenceLinks: new Map(),
    claims: new Map(),
    phases: new Map([['phase1', { _id: 'phase1', projectId: 'p1', phaseId: 'prd', upstreamChanges: [] }]]),
    artifacts: new Map([['artifact1', { _id: 'artifact1', projectId: 'p1', phaseId: 'prd', evidenceSourceIds: [] }]]),
    artifactVersions: new Map(),
    tickets: new Map(),
    verificationResults: new Map(),
  };
  let nextId = 0;
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: 'u1' }) },
    db: {
      get: async (id: string) => Object.values(tables).map((table) => table.get(id)).find(Boolean) ?? null,
      insert: async (tableName: string, value: Record<string, unknown>) => {
        const id = `${tableName}_${++nextId}`;
        tables[tableName].set(id, { ...value, _id: id });
        return id;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        const table = Object.values(tables).find((candidate) => candidate.has(id));
        const row = table?.get(id);
        if (table && row) table.set(id, { ...row, ...value });
      },
      query: (tableName: string) => {
        let predicates: Array<(row: FakeRow) => boolean> = [];
        const builder: {
          withIndex: (index: string, apply: (q: FakeIndexQuery) => unknown) => typeof builder;
          filter: (apply: (q: { field: (name: string) => string; eq: (field: string, value: unknown) => (row: FakeRow) => boolean }) => unknown) => typeof builder;
          collect: () => Promise<FakeRow[]>;
          first: () => Promise<FakeRow | null>;
          order: (direction: string) => typeof builder;
        } = {
          withIndex: (_index, apply) => {
            const indexPredicates: Array<(row: FakeRow) => boolean> = [];
            const indexQuery: FakeIndexQuery = {
              eq: (field, value) => {
                indexPredicates.push((row) => row[field] === value);
                return indexQuery;
              },
            };
            apply(indexQuery);
            predicates = [...predicates, ...indexPredicates];
            return builder;
          },
          filter: (apply) => {
            const predicate = apply({
              field: (field) => field,
              eq: (field, value) => (row) => row[field] === value,
            });
            if (typeof predicate === 'function') predicates.push(predicate as (row: FakeRow) => boolean);
            return builder;
          },
          collect: async () => [...tables[tableName].values()].filter((row) => predicates.every((predicate) => predicate(row))),
          first: async () => (await builder.collect())[0] ?? null,
          order: () => builder,
        };
        return builder;
      },
    },
    __tables: tables,
  };
  return ctx;
}

const asMutationCtx = (ctx: FakeContext) => ctx as unknown as MutationCtx;

describe('evidence source revisions', () => {
  it('keeps prior answer revisions and avoids duplicates for unchanged answers', async () => {
    const ctx = makeCtx();
    const args = {
      projectId: 'p1' as never,
      sourceKey: 'answer:prd:q1',
      kind: 'answer' as const,
      locator: 'prd/q1',
      revisionLabel: 'Answer in PRD',
      content: 'Use server side sessions.',
      capturedBy: 'u1',
    };

    const first = await captureEvidenceSource(asMutationCtx(ctx), args);
    const unchanged = await captureEvidenceSource(asMutationCtx(ctx), args);
    const changed = await captureEvidenceSource(asMutationCtx(ctx), { ...args, content: 'Use short lived server side sessions.' });

    expect(first?._id).toBe(unchanged?._id);
    expect(changed?.revision).toBe(2);
    expect(ctx.__tables.evidenceSources.size).toBe(2);
    expect(ctx.__tables.evidenceSources.get(first!._id)?.excerpt).toBe('Use server side sessions.');
  });

  it('marks linked claims, tickets, phases, and prior checks when an answer changes', async () => {
    const ctx = makeCtx();
    const source = await captureEvidenceSource(asMutationCtx(ctx), {
      projectId: 'p1' as never,
      sourceKey: 'answer:prd:q1',
      kind: 'answer',
      locator: 'prd/q1',
      revisionLabel: 'Answer in PRD',
      content: 'Keep session records for seven days.',
      capturedBy: 'u1',
    });
    ctx.__tables.claims.set('claim1', {
      _id: 'claim1', projectId: 'p1', phaseId: 'prd', artifactId: 'artifact1', claimId: 'REQ-0001', reviewStatus: 'current',
    });
    ctx.__tables.evidenceLinks.set('link1', { _id: 'link1', projectId: 'p1', claimId: 'claim1', sourceId: source?._id });
    ctx.__tables.tickets.set('ticket1', { _id: 'ticket1', projectId: 'p1', claimIds: ['REQ-0001'] });
    ctx.__tables.verificationResults.set('result1', { _id: 'result1', projectId: 'p1', sourceRevisionSet: [source?._id] });

    await captureEvidenceSource(asMutationCtx(ctx), {
      projectId: 'p1' as never,
      sourceKey: 'answer:prd:q1',
      kind: 'answer',
      locator: 'prd/q1',
      revisionLabel: 'Answer in PRD',
      content: 'Keep session records for thirty days.',
      capturedBy: 'u1',
    });

    expect(ctx.__tables.claims.get('claim1')?.reviewStatus).toBe('needs_review');
    expect(ctx.__tables.tickets.get('ticket1')?.evidenceReviewStatus).toBe('needs_review');
    expect(ctx.__tables.phases.get('phase1')?.isStale).toBe(true);
    expect(ctx.__tables.verificationResults.get('result1')?.outdatedAt).toBeTypeOf('number');
  });

  it('stores model source references only when they were in the generation allowlist', async () => {
    const ctx = makeCtx();
    const source = await captureEvidenceSource(asMutationCtx(ctx), {
      projectId: 'p1' as never,
      sourceKey: 'answer:prd:q1',
      kind: 'answer',
      locator: 'prd/q1',
      revisionLabel: 'Answer in PRD',
      content: 'The API must reject expired sessions.',
      capturedBy: 'u1',
    });
    const artifact = ctx.__tables.artifacts.get('artifact1');
    if (artifact) artifact.evidenceSourceIds = [source?._id];

    await reconcileArtifactClaims(asMutationCtx(ctx), {
      projectId: 'p1' as never,
      phaseId: 'prd',
      artifactId: 'artifact1' as never,
      content: [
        `- The API must reject expired sessions. <!-- evidence-source: ${source?._id} -->`,
        '- The API should lock every server indefinitely. <!-- evidence-source: forged-id -->',
      ].join('\n'),
      evidenceSourceIds: [source?._id] as never,
    });

    const claims = [...ctx.__tables.claims.values()];
    expect(claims).toHaveLength(2);
    expect(claims.every((claim) => claim.decisionStatus === 'proposed' && claim.reviewStatus === 'needs_review')).toBe(true);
    expect(ctx.__tables.evidenceLinks.size).toBe(1);
    expect([...ctx.__tables.evidenceLinks.values()][0]?.supportStatus).toBe('suggested');
  });

  it('captures a new repository revision when the commit changes even if file content does not', async () => {
    const ctx = makeCtx();
    const base = {
      projectId: 'p1' as never,
      sourceKey: 'repository_file:owner/repo:src/session.ts',
      kind: 'repository_file' as const,
      locator: 'src/session.ts',
      content: 'export const ttlDays = 7;',
      capturedBy: 'repository_scan',
    };
    const first = await captureEvidenceSource(asMutationCtx(ctx), { ...base, revisionLabel: 'owner/repo@abc', commitSha: 'abc' });
    const second = await captureEvidenceSource(asMutationCtx(ctx), { ...base, revisionLabel: 'owner/repo@def', commitSha: 'def' });

    expect(first?._id).not.toBe(second?._id);
    expect(second?.revision).toBe(2);
    expect(ctx.__tables.evidenceSources.size).toBe(2);
  });

  it('marks verification runs outdated when a claim in their artifact revision set changes', async () => {
    const ctx = makeCtx();
    ctx.__tables.claims.set('old-claim', {
      _id: 'old-claim', projectId: 'p1', phaseId: 'prd', artifactId: 'artifact1', artifactVersion: 1,
      claimId: 'REQ-0001', text: 'The API must reject expired sessions.', reviewStatus: 'current', retiredAt: undefined,
    });
    ctx.__tables.verificationResults.set('result2', {
      _id: 'result2', projectId: 'p1', phaseId: 'stories', artifactVersionSet: ['artifact1:v1'],
    });

    await reconcileArtifactClaims(asMutationCtx(ctx), {
      projectId: 'p1' as never,
      phaseId: 'prd',
      artifactId: 'artifact1' as never,
      content: '- The API must reject expired sessions and revoked sessions.',
    });

    expect(ctx.__tables.verificationResults.get('result2')?.outdatedAt).toBeTypeOf('number');
  });
});
