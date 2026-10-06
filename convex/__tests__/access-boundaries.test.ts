import { describe, expect, it } from 'vitest';
import type { Id } from '../_generated/dataModel';
import { getProjectMetricsHandler, getProjectTagsHandler } from '../projectMetrics';
import { createNotificationHandler } from '../notifications';
import { suspendUserHandler } from '../admin';
import { requireActiveAccount } from '../lib/account';
import { assertAdmin } from '../actions/checkEndpoints';

type Row = Record<string, unknown> & { _id: string };

function store(seed: Record<string, Row[]>) {
  const tables: Record<string, Map<string, Row>> = {};
  let next = 0;
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = new Map(rows.map((row) => [row._id, row]));
  }
  return {
    tables,
    insert(table: string, value: Record<string, unknown>) {
      const id = `${table}_${++next}`;
      tables[table] ??= new Map();
      tables[table].set(id, { ...value, _id: id });
      return id;
    },
  };
}

function query(tables: Record<string, Map<string, Row>>, table: string) {
  let keep = (_row: Row) => true;
  const chain = {
    withIndex(_name: string, apply: (q: { eq: (field: string, value: unknown) => unknown }) => void) {
      const filters: Array<(row: Row) => boolean> = [];
      const index = {
        eq(field: string, value: unknown) {
          filters.push((row) => row[field] === value);
          return index;
        },
      };
      apply(index);
      const previous = keep;
      keep = (row) => previous(row) && filters.every((filter) => filter(row));
      return chain;
    },
    collect: async () => [...(tables[table]?.values() ?? [])].filter(keep),
    unique: async () => [...(tables[table]?.values() ?? [])].filter(keep)[0] ?? null,
  };
  return chain;
}

function ctxFor(subject: string | null, seed: Record<string, Row[]>) {
  const db = store(seed);
  const ctx = {
    auth: {
      getUserIdentity: async () =>
        subject ? { subject, role: subject === 'admin' ? 'admin' : undefined } : null,
    },
    db: {
      get: async (id: string) =>
        Object.values(db.tables).map((table) => table.get(id)).find(Boolean) ?? null,
      insert: async (table: string, value: Record<string, unknown>) => db.insert(table, value),
      patch: async (id: string, value: Record<string, unknown>) => {
        for (const table of Object.values(db.tables)) {
          const row = table.get(id);
          if (row) table.set(id, { ...row, ...value });
        }
      },
      query: (table: string) => query(db.tables, table),
    },
    runQuery: async () => {
      throw new Error('should not reach system credentials');
    },
  };
  return { ctx, db };
}

const project = { _id: 'p1', userId: 'owner', updatedAt: 1, skippedPhases: [] };

describe('project reads stay with the owner', () => {
  it('refuses another signed-in user the metrics', async () => {
    const { ctx } = ctxFor('attacker', { projects: [project], projectMetrics: [], phases: [] });
    await expect(
      getProjectMetricsHandler(ctx as never, { projectId: 'p1' as Id<'projects'> }),
    ).rejects.toThrow('Forbidden');
  });

  it('refuses another signed-in user the tags', async () => {
    const { ctx } = ctxFor('attacker', {
      projects: [project],
      projectTags: [{ _id: 'tag1', projectId: 'p1', tag: 'secret' }],
    });
    await expect(
      getProjectTagsHandler(ctx as never, { projectId: 'p1' as Id<'projects'> }),
    ).rejects.toThrow('Forbidden');
  });
});

describe('notifications', () => {
  it("refuses to write into someone else's inbox", async () => {
    const { ctx, db } = ctxFor('attacker', { notifications: [] });
    await expect(
      createNotificationHandler(ctx as never, {
        userId: 'owner',
        type: 'system_announcement',
        title: 'Open this',
        message: 'planted',
        metadata: { actionUrl: 'https://evil.example' },
      }),
    ).rejects.toThrow('Forbidden');
    expect(db.tables.notifications?.size ?? 0).toBe(0);
  });

  it('writes a notification for the signed-in user', async () => {
    const { ctx, db } = ctxFor('owner', { notifications: [] });
    const result = await createNotificationHandler(ctx as never, {
      type: 'generation_complete',
      title: 'Done',
      message: 'Phase finished',
    });
    expect(result.success).toBe(true);
    expect([...db.tables.notifications.values()][0].userId).toBe('owner');
  });
});

describe('account suspension', () => {
  it('records who is suspended and a second call stays suspended', async () => {
    const { ctx, db } = ctxFor('admin', { accountRestrictions: [], auditLogs: [] });
    await suspendUserHandler(ctx as never, { userId: 'owner', reason: 'abuse' });
    await suspendUserHandler(ctx as never, { userId: 'owner', reason: 'abuse again' });
    const rows = [...db.tables.accountRestrictions.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 'owner', reason: 'abuse again' });
    expect(typeof rows[0].suspendedAt).toBe('number');
  });

  it('blocks generation for a suspended account', async () => {
    const { ctx } = ctxFor('owner', {
      accountRestrictions: [{ _id: 'r1', userId: 'owner', suspendedAt: 10 }],
    });
    await expect(requireActiveAccount(ctx as never)).rejects.toThrow('Account suspended');
  });

  it('allows a user with no restriction row', async () => {
    const { ctx } = ctxFor('owner', { accountRestrictions: [] });
    await expect(requireActiveAccount(ctx as never)).resolves.toBeUndefined();
  });
});

describe('provider endpoint check', () => {
  it('refuses a caller who is not an admin', async () => {
    const { ctx } = ctxFor('owner', {});
    await expect(assertAdmin(ctx as never)).rejects.toThrow('Admin role required');
  });
});
