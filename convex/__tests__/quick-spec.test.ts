import { describe, expect, it } from 'vitest';
import type { MutationCtx } from '../_generated/server';
import { createProjectFromQuickSpecHandler, describeWithQuickSpec } from '../projects';
import { migrateSavedQuickSpecsHandler } from '../changes';
import { DESCRIPTION_MAX } from '../../lib/project-input';

type FakeRow = Record<string, unknown> & { _id: string };
type FakeIndexQuery = { eq: (field: string, value: unknown) => FakeIndexQuery };
type FakeContext = {
  auth: { getUserIdentity: () => Promise<{ subject: string }> };
  db: unknown;
  __tables: Record<string, Map<string, FakeRow>>;
};

function makeCtx(authUserId = 'owner', projectUserId = 'owner'): FakeContext {
  const tables: Record<string, Map<string, FakeRow>> = {
    projects: new Map([['p1', { _id: 'p1', userId: projectUserId }]]),
    phases: new Map(),
    artifacts: new Map(),
    artifactVersions: new Map(),
    claims: new Map(),
    evidenceLinks: new Map(),
    verificationResults: new Map(),
    evidenceReviews: new Map(),
    claimRevisions: new Map(),
    changes: new Map(),
  };
  let nextId = 0;
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: authUserId }) },
    db: {
      get: async (id: string) => Object.values(tables).map((table) => table.get(id)).find(Boolean) ?? null,
      insert: async (tableName: string, value: Record<string, unknown>) => {
        const id = `${tableName}_${++nextId}`;
        tables[tableName].set(id, { ...value, _id: id });
        return id;
      },
      delete: async (id: string) => {
        Object.values(tables).find((table) => table.has(id))?.delete(id);
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        const table = Object.values(tables).find((candidate) => candidate.has(id));
        const row = table?.get(id);
        if (table && row) table.set(id, { ...row, ...value });
      },
      query: (tableName: string) => {
        let predicate = (_row: FakeRow) => true;
        const query: {
          withIndex: (index: string, apply: (q: FakeIndexQuery) => unknown) => typeof query;
          order: (direction: string) => typeof query;
          first: () => Promise<FakeRow | null>;
          collect: () => Promise<FakeRow[]>;
        } = {
          withIndex: (_index, apply) => {
            const conditions: Array<(row: FakeRow) => boolean> = [];
            const indexQuery: FakeIndexQuery = {
              eq: (field, value) => {
                conditions.push((row) => row[field] === value);
                return indexQuery;
              },
            };
            apply(indexQuery);
            predicate = (row) => conditions.every((condition) => condition(row));
            return query;
          },
          order: () => query,
          first: async () => [...tables[tableName].values()].find(predicate) ?? null,
          collect: async () => [...tables[tableName].values()].filter(predicate),
        };
        return query;
      },
    },
    __tables: tables,
  };
  return ctx;
}

const asMutationCtx = (ctx: FakeContext) => ctx as unknown as MutationCtx;

describe('createProjectFromQuickSpec', () => {
  const input = {
    title: 'Session refresh',
    description: 'Refresh expired sessions without a sign-out.',
    content: '# Session refresh\n\nRequirements.',
  };

  it('creates a Lite project whose description carries the quick spec', async () => {
    const ctx = makeCtx();
    const projectId = await createProjectFromQuickSpecHandler(asMutationCtx(ctx), input);

    expect(ctx.__tables.projects.get(projectId)).toMatchObject({
      userId: 'owner',
      title: 'Session refresh',
      description: 'Refresh expired sessions without a sign-out.\n\n## Quick spec\n\n# Session refresh\n\nRequirements.',
      mode: 'quick',
      skippedPhases: ['domainModel', 'artifacts'],
    });
    expect([...ctx.__tables.phases.values()].filter((phase) => phase.projectId === projectId)).toHaveLength(8);
    expect(ctx.__tables.artifacts.size).toBe(0);
  });

  it('refuses an empty spec', async () => {
    await expect(
      createProjectFromQuickSpecHandler(asMutationCtx(makeCtx()), { ...input, content: '  ' })
    ).rejects.toThrow('Title and content are required');
  });
});

describe('describeWithQuickSpec', () => {
  it('cuts a long quick spec to fit the description limit and says so', () => {
    const description = describeWithQuickSpec('A ledger.', 'x'.repeat(DESCRIPTION_MAX));

    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(description.startsWith('A ledger.\n\n## Quick spec\n\nxxx')).toBe(true);
    expect(description.endsWith('[Quick spec truncated to fit the project description.]')).toBe(true);
  });
});

describe('migrateSavedQuickSpecs', () => {
  it('turns each saved quick spec into a draft change and deletes the old slot', async () => {
    const ctx = makeCtx();
    ctx.__tables.artifacts.set('a-quick', { _id: 'a-quick', _creationTime: 5, projectId: 'p1', phaseId: 'quick', type: 'quickSpec', title: 'Session refresh', content: '# Session refresh' });
    ctx.__tables.artifacts.set('a-prd', { _id: 'a-prd', projectId: 'p1', phaseId: 'prd', type: 'prd', title: 'PRD', content: '# PRD' });
    ctx.__tables.artifactVersions.set('v1', { _id: 'v1', artifactId: 'a-quick' });
    ctx.__tables.claims.set('cq', { _id: 'cq', projectId: 'p1', phaseId: 'quick', artifactId: 'a-quick' });
    ctx.__tables.claims.set('cp', { _id: 'cp', projectId: 'p1', phaseId: 'prd', artifactId: 'a-prd' });
    ctx.__tables.evidenceLinks.set('lq', { _id: 'lq', claimId: 'cq' });

    expect(await migrateSavedQuickSpecsHandler(asMutationCtx(ctx))).toEqual({ migrated: 1 });

    expect([...ctx.__tables.changes.values()]).toEqual([
      expect.objectContaining({
        projectId: 'p1', changeNumber: 1, kind: 'feature', title: 'Session refresh',
        quickSpec: '# Session refresh', status: 'draft', createdAt: 5,
      }),
    ]);
    expect([...ctx.__tables.artifacts.keys()]).toEqual(['a-prd']);
    expect([...ctx.__tables.claims.keys()]).toEqual(['cp']);
    expect(ctx.__tables.artifactVersions.size).toBe(0);
    expect(ctx.__tables.evidenceLinks.size).toBe(0);
    expect(await migrateSavedQuickSpecsHandler(asMutationCtx(ctx))).toEqual({ migrated: 0 });
  });
});
