import { describe, expect, it } from 'vitest';
import type { MutationCtx } from '../_generated/server';
import { saveQuickSpecHandler } from '../artifacts';

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
const args = { projectId: 'p1' as never, title: 'Session refresh', content: '# Session refresh\n\nRequirements.' };

describe('saveQuickSpec', () => {
  it('saves a quickSpec artifact without adding a workflow phase', async () => {
    const ctx = makeCtx();
    const artifactId = await saveQuickSpecHandler(asMutationCtx(ctx), args);
    const artifact = ctx.__tables.artifacts.get(artifactId);

    expect(artifact).toMatchObject({ phaseId: 'quick', type: 'quickSpec', title: args.title, content: args.content });
    expect(ctx.__tables.phases.size).toBe(0);
  });

  it('keeps the artifact ID and snapshots the previous content on update', async () => {
    const ctx = makeCtx();
    const firstId = await saveQuickSpecHandler(asMutationCtx(ctx), args);
    const secondId = await saveQuickSpecHandler(asMutationCtx(ctx), { ...args, content: '# Session refresh v2' });

    expect(secondId).toBe(firstId);
    expect(ctx.__tables.artifactVersions.size).toBe(1);
    expect([...ctx.__tables.artifactVersions.values()][0]?.content).toBe(args.content);
    expect(ctx.__tables.artifacts.get(firstId)?.content).toBe('# Session refresh v2');
  });

  it('rejects a project owned by another user', async () => {
    const ctx = makeCtx('attacker', 'owner');
    await expect(saveQuickSpecHandler(asMutationCtx(ctx), args)).rejects.toThrow('Forbidden');
    expect(ctx.__tables.artifacts.size).toBe(0);
  });
});
