import { describe, expect, it } from 'vitest';
import type { MutationCtx } from '../_generated/server';
import {
  abandonChangeHandler,
  createChangeHandler,
  replaceChangeOpsHandler,
  type ChangeOpInput,
} from '../changes';

type FakeRow = Record<string, unknown> & { _id: string };
type FakeIndexQuery = { eq: (field: string, value: unknown) => FakeIndexQuery };
type FakeContext = { __tables: Record<string, Map<string, FakeRow>> } & Record<string, unknown>;

function makeCtx(authUserId = 'owner'): FakeContext {
  const tables: Record<string, Map<string, FakeRow>> = {
    projects: new Map([
      ['p1', { _id: 'p1', userId: 'owner' }],
      ['p2', { _id: 'p2', userId: 'someone-else' }],
    ]),
    claims: new Map([
      ['c12', { _id: 'c12', projectId: 'p1', phaseId: 'prd', claimId: 'REQ-0012', text: 'Owners invite members by email.' }],
      ['c13', { _id: 'c13', projectId: 'p1', phaseId: 'prd', claimId: 'REQ-0013', text: 'Old rule.', retiredAt: 1 }],
      ['cq', { _id: 'cq', projectId: 'p1', phaseId: 'quick', claimId: 'REQ-0014', text: 'From a quick spec.' }],
      ['c90', { _id: 'c90', projectId: 'p2', phaseId: 'prd', claimId: 'REQ-0001', text: 'Another project.' }],
    ]),
    evidenceSources: new Map([
      ['s1', { _id: 's1', projectId: 'p1' }],
      ['s9', { _id: 's9', projectId: 'p2' }],
    ]),
    changes: new Map(),
    changeOps: new Map(),
  };
  let nextId = 0;
  const findTable = (id: string) => Object.values(tables).find((table) => table.has(id));
  return {
    auth: { getUserIdentity: async () => ({ subject: authUserId }) },
    db: {
      get: async (id: string) => findTable(id)?.get(id) ?? null,
      insert: async (tableName: string, value: Record<string, unknown>) => {
        const id = `${tableName}_${++nextId}`;
        tables[tableName].set(id, { ...value, _id: id });
        return id;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        const table = findTable(id);
        const row = table?.get(id);
        if (table && row) table.set(id, { ...row, ...value });
      },
      delete: async (id: string) => {
        findTable(id)?.delete(id);
      },
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
        };
        return q;
      },
    },
    __tables: tables,
  };
}

const asCtx = (ctx: FakeContext) => ctx as unknown as MutationCtx;
const feature = { projectId: 'p1' as never, kind: 'feature' as const, title: ' Invite links ', summary: ' Let owners share a link. ' };
const bug = { observed: 'The link 404s.', expected: 'The link opens the invite.', reproduction: 'Open an invite link.' };

async function draft(ctx: FakeContext) {
  return createChangeHandler(asCtx(ctx), feature);
}

describe('createChange', () => {
  it('numbers changes per project and trims what the reader typed', async () => {
    const ctx = makeCtx();
    const first = await draft(ctx);
    const second = await createChangeHandler(asCtx(ctx), { ...feature, kind: 'bugfix', bug });

    expect(ctx.__tables.changes.get(first)).toMatchObject({
      projectId: 'p1', changeNumber: 1, kind: 'feature', title: 'Invite links', summary: 'Let owners share a link.', status: 'draft',
    });
    expect(ctx.__tables.changes.get(second)).toMatchObject({ changeNumber: 2, kind: 'bugfix', bug });
    expect(ctx.__tables.projects.get('p1')?.nextChangeNumber).toBe(3);
  });

  it('refuses a project with no live requirements in its documents', async () => {
    const ctx = makeCtx();
    ctx.__tables.claims.delete('c12');

    await expect(draft(ctx)).rejects.toThrow("Generate the project's requirements before starting a change");
  });

  it('refuses a bug fix without a full bug report, and a feature with one', async () => {
    const ctx = makeCtx();

    await expect(
      createChangeHandler(asCtx(ctx), { ...feature, kind: 'bugfix', bug: { ...bug, reproduction: ' ' } }),
    ).rejects.toThrow('A bug fix needs the observed behaviour');
    await expect(createChangeHandler(asCtx(ctx), { ...feature, bug })).rejects.toThrow('Only a bug fix carries a bug report');
  });

  it("refuses someone else's project", async () => {
    await expect(draft(makeCtx('intruder'))).rejects.toThrow('Forbidden');
  });
});

describe('replaceChangeOps', () => {
  const add: ChangeOpInput = {
    reason: 'Owners asked for links.',
    evidenceSourceIds: ['s1' as never],
    op: { type: 'add', phaseId: 'prd', kind: 'requirement', text: ' Owners may share an invite link. ' },
  };
  const modify: ChangeOpInput = {
    reason: 'Email is no longer the only way in.',
    evidenceSourceIds: [],
    op: { type: 'modify', claim: 'c12' as never, baseText: 'Owners invite members by email.', text: 'Owners invite members by email or link.' },
  };

  it('stores the operations in order and replaces the previous set', async () => {
    const ctx = makeCtx();
    const changeId = await draft(ctx);
    await replaceChangeOpsHandler(asCtx(ctx), { changeId, ops: [modify] });
    await replaceChangeOpsHandler(asCtx(ctx), { changeId, ops: [add, modify] });

    const rows = [...ctx.__tables.changeOps.values()].sort((a, b) => Number(a.order) - Number(b.order));
    expect(rows.map((row) => [row.order, (row.op as { type: string }).type])).toEqual([
      [0, 'add'],
      [1, 'modify'],
    ]);
    expect(rows[0]?.op).toMatchObject({ text: 'Owners may share an invite link.' });
  });

  it.each([
    ['a retired claim', { type: 'remove', claim: 'c13', baseText: 'Old rule.' }, 'targets a requirement that is not live in this project'],
    ['a quick spec claim', { type: 'reaffirm', claim: 'cq', baseText: 'From a quick spec.' }, 'targets a requirement that is not live in this project'],
    ["another project's claim", { type: 'remove', claim: 'c90', baseText: 'Another project.' }, 'targets a requirement that is not live in this project'],
    ['an unknown phase', { type: 'add', phaseId: 'quick', kind: 'requirement', text: 'Anything at all here.' }, 'adds to an unknown phase'],
    ['unchanged wording', { type: 'modify', claim: 'c12', baseText: 'Owners invite members by email.', text: 'Owners invite members by email.' }, 'does not change the wording'],
  ])('refuses an operation on %s', async (_label, op, message) => {
    const ctx = makeCtx();
    const changeId = await draft(ctx);

    await expect(
      replaceChangeOpsHandler(asCtx(ctx), { changeId, ops: [{ reason: 'Because.', evidenceSourceIds: [], op: op as never }] }),
    ).rejects.toThrow(`Operation 1 ${message}`);
    expect(ctx.__tables.changeOps.size).toBe(0);
  });

  it('refuses evidence from another project and an operation without a reason', async () => {
    const ctx = makeCtx();
    const changeId = await draft(ctx);

    await expect(
      replaceChangeOpsHandler(asCtx(ctx), { changeId, ops: [{ ...add, evidenceSourceIds: ['s9' as never] }] }),
    ).rejects.toThrow('Operation 1 cites evidence from another project');
    await expect(
      replaceChangeOpsHandler(asCtx(ctx), { changeId, ops: [add, { ...modify, reason: '  ' }] }),
    ).rejects.toThrow('Operation 2 needs a reason');
  });

  it('edits only a draft', async () => {
    const ctx = makeCtx();
    const changeId = await draft(ctx);
    await abandonChangeHandler(asCtx(ctx), { changeId });

    await expect(replaceChangeOpsHandler(asCtx(ctx), { changeId, ops: [add] })).rejects.toThrow(
      'Only a draft change can be edited',
    );
  });
});

describe('abandonChange', () => {
  it('abandons a draft once', async () => {
    const ctx = makeCtx();
    const changeId = await draft(ctx);
    await abandonChangeHandler(asCtx(ctx), { changeId });

    expect(ctx.__tables.changes.get(changeId)?.status).toBe('abandoned');
    await expect(abandonChangeHandler(asCtx(ctx), { changeId })).rejects.toThrow('Only a draft change can be abandoned');
  });

  it("refuses someone else's change", async () => {
    const ctx = makeCtx();
    const changeId = await draft(ctx);
    ctx.__tables.projects.set('p1', { _id: 'p1', userId: 'someone-else' });

    await expect(abandonChangeHandler(asCtx(ctx), { changeId })).rejects.toThrow('Forbidden');
  });
});
