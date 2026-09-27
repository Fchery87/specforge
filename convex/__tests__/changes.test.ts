import { describe, expect, it } from 'vitest';
import type { MutationCtx } from '../_generated/server';
import {
  abandonChangeHandler,
  applyChangeHandler,
  createChangeHandler,
  getDraftContextHandler,
  replaceChangeOpsHandler,
  type ChangeOpInput,
} from '../changes';

type FakeRow = Record<string, unknown> & { _id: string };
type FakeIndexQuery = { eq: (field: string, value: unknown) => FakeIndexQuery };
type FakeContext = { __tables: Record<string, Map<string, FakeRow>> } & Record<string, unknown>;

function makeCtx(authUserId = 'owner'): FakeContext {
  const tables: Record<string, Map<string, FakeRow>> = {
    projects: new Map([
      ['p1', { _id: 'p1', userId: 'owner', nextClaimNumber: 15 }],
      ['p2', { _id: 'p2', userId: 'someone-else' }],
    ]),
    claims: new Map([
      ['c12', { _id: 'c12', projectId: 'p1', phaseId: 'prd', claimId: 'REQ-0012', text: 'Owners invite members by email.' }],
      ['c13', { _id: 'c13', projectId: 'p1', phaseId: 'prd', claimId: 'REQ-0013', text: 'Old rule.', retiredAt: 1 }],
      ['cq', { _id: 'cq', projectId: 'p1', phaseId: 'quick', claimId: 'REQ-0014', text: 'From a quick spec.' }],
      ['c90', { _id: 'c90', projectId: 'p2', phaseId: 'prd', claimId: 'REQ-0001', text: 'Another project.' }],
    ]),
    evidenceSources: new Map([
      ['s1', { _id: 's1', projectId: 'p1', kind: 'answer', sourceKey: 'answer:prd:q1', revision: 1, locator: 'prd/q1', excerpt: 'An answer.', capturedAt: 1 }],
      ['s9', { _id: 's9', projectId: 'p2', kind: 'repository_file', sourceKey: 'repo:x', revision: 1, locator: 'x.ts', excerpt: 'Elsewhere.', capturedAt: 1 }],
      ['f1', { _id: 'f1', projectId: 'p1', kind: 'repository_file', sourceKey: 'repo:invites', revision: 1, locator: 'lib/invites.ts', excerpt: 'old', capturedAt: 2 }],
      ['f2', { _id: 'f2', projectId: 'p1', kind: 'repository_file', sourceKey: 'repo:invites', revision: 2, locator: 'lib/invites.ts', excerpt: 'export function sendInvite', capturedAt: 3 }],
    ]),
    changes: new Map(),
    changeOps: new Map(),
    claimRevisions: new Map(),
    evidenceLinks: new Map([['link12', { _id: 'link12', projectId: 'p1', claimId: 'c12', sourceId: 's1', supportStatus: 'confirmed' }]]),
    artifacts: new Map([
      ['prd-doc', { _id: 'prd-doc', projectId: 'p1', phaseId: 'prd' }],
      ['stories-doc', { _id: 'stories-doc', projectId: 'p1', phaseId: 'stories' }],
    ]),
    phases: new Map([
      ['ph-prd', { _id: 'ph-prd', projectId: 'p1', phaseId: 'prd' }],
      ['ph-stories', { _id: 'ph-stories', projectId: 'p1', phaseId: 'stories' }],
      ['ph-specs', { _id: 'ph-specs', projectId: 'p1', phaseId: 'specs' }],
    ]),
    verificationResults: new Map([
      ['vr-prd', { _id: 'vr-prd', projectId: 'p1', phaseId: 'prd' }],
      ['vr-specs', { _id: 'vr-specs', projectId: 'p1', phaseId: 'specs' }],
    ]),
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
          first: async () => [...tables[tableName].values()].find(predicate) ?? null,
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

describe('applyChange', () => {
  const op = (reason: string, value: unknown, evidenceSourceIds: string[] = []): ChangeOpInput => ({
    reason,
    evidenceSourceIds: evidenceSourceIds as never,
    op: value as never,
  });
  const rewordEmail = op('Links are also allowed.', {
    type: 'modify', claim: 'c12', baseText: 'Owners invite members by email.', text: 'Owners invite members by email or link.',
  }, ['s1']);
  const addCriterion = op('The regression test.', {
    type: 'add', phaseId: 'stories', kind: 'acceptance_criterion', text: 'Given an invite link, when it is opened, then the invite page loads.',
  }, ['s1']);

  async function draftWith(ctx: FakeContext, ops: ChangeOpInput[], kind: 'feature' | 'bugfix' = 'feature') {
    const changeId = await createChangeHandler(asCtx(ctx), { ...feature, kind, ...(kind === 'bugfix' ? { bug } : {}) });
    await replaceChangeOpsHandler(asCtx(ctx), { changeId, ops });
    return changeId;
  }

  it('adds, rewords with history, removes, and marks the touched documents out of date', async () => {
    const ctx = makeCtx();
    ctx.__tables.claims.set('c20', { _id: 'c20', projectId: 'p1', phaseId: 'specs', claimId: 'REQ-0020', text: 'Invites expire after a day.' });
    const changeId = await draftWith(ctx, [
      addCriterion,
      rewordEmail,
      op('Invites no longer expire.', { type: 'remove', claim: 'c20', baseText: 'Invites expire after a day.' }),
    ]);

    const result = await applyChangeHandler(asCtx(ctx), { changeId });

    expect(result).toEqual({ status: 'applied', addedClaimIds: ['REQ-0015'] });
    expect([...ctx.__tables.claims.values()].find((claim) => claim.claimId === 'REQ-0015')).toMatchObject({
      projectId: 'p1', phaseId: 'stories', artifactId: 'stories-doc', kind: 'acceptance_criterion',
      text: 'Given an invite link, when it is opened, then the invite page loads.', decisionStatus: 'confirmed',
    });
    expect(ctx.__tables.claims.get('c12')).toMatchObject({ claimId: 'REQ-0012', text: 'Owners invite members by email or link.' });
    expect([...ctx.__tables.claimRevisions.values()]).toEqual([
      expect.objectContaining({ claim: 'c12', text: 'Owners invite members by email.', changeId }),
    ]);
    expect(ctx.__tables.evidenceLinks.get('link12')?.claimId).toBe('c12');
    expect(ctx.__tables.claims.get('c20')?.retiredAt).toBeTypeOf('number');
    expect(ctx.__tables.projects.get('p1')?.nextClaimNumber).toBe(16);
    expect(['ph-prd', 'ph-stories', 'ph-specs'].map((id) => ctx.__tables.phases.get(id)?.staleReason)).toEqual([
      'CHG-0001 applied', 'CHG-0001 applied', 'CHG-0001 applied',
    ]);
    expect(ctx.__tables.verificationResults.get('vr-prd')?.outdatedAt).toBeTypeOf('number');
    expect(ctx.__tables.changes.get(changeId)).toMatchObject({ status: 'applied' });
  });

  it('leaves untouched documents alone', async () => {
    const ctx = makeCtx();
    const changeId = await draftWith(ctx, [rewordEmail]);

    await applyChangeHandler(asCtx(ctx), { changeId });

    expect(ctx.__tables.phases.get('ph-prd')?.isStale).toBe(true);
    expect(ctx.__tables.phases.get('ph-stories')?.isStale).toBeUndefined();
    expect(ctx.__tables.verificationResults.get('vr-specs')?.outdatedAt).toBeUndefined();
  });

  it('applies nothing and names the operation when a requirement was reworded after the draft', async () => {
    const ctx = makeCtx();
    const changeId = await draftWith(ctx, [addCriterion, rewordEmail]);
    ctx.__tables.claims.set('c12', { ...ctx.__tables.claims.get('c12')!, text: 'Owners invite members by SMS.' });

    const result = await applyChangeHandler(asCtx(ctx), { changeId });

    expect(result).toEqual({
      status: 'conflict',
      conflicts: [{ order: 1, claimId: 'REQ-0012', reason: 'The requirement was reworded after this change was drafted' }],
    });
    expect(ctx.__tables.claimRevisions.size).toBe(0);
    expect([...ctx.__tables.claims.values()].some((claim) => claim.claimId === 'REQ-0015')).toBe(false);
    expect(ctx.__tables.changes.get(changeId)?.status).toBe('draft');
  });

  it('reports a requirement retired since the draft, and two operations on one requirement', async () => {
    const ctx = makeCtx();
    const changeId = await draftWith(ctx, [
      rewordEmail,
      op('Also reaffirmed.', { type: 'reaffirm', claim: 'c12', baseText: 'Owners invite members by email.' }),
    ]);
    const retired = await draftWith(ctx, [rewordEmail]);
    ctx.__tables.claims.set('c12', { ...ctx.__tables.claims.get('c12')!, retiredAt: 5 });

    expect(await applyChangeHandler(asCtx(ctx), { changeId: retired })).toEqual({
      status: 'conflict',
      conflicts: [{ order: 0, claimId: 'REQ-0012', reason: 'The requirement is no longer live' }],
    });
    ctx.__tables.claims.set('c12', { ...ctx.__tables.claims.get('c12')!, retiredAt: undefined });
    expect(await applyChangeHandler(asCtx(ctx), { changeId })).toEqual({
      status: 'conflict',
      conflicts: [{ order: 1, claimId: 'REQ-0012', reason: 'Operation 1 already targets this requirement' }],
    });
  });

  it('requires a bug fix to add a regression criterion', async () => {
    const ctx = makeCtx();
    const without = await draftWith(ctx, [
      op('The spec is right; the code is wrong.', { type: 'reaffirm', claim: 'c12', baseText: 'Owners invite members by email.' }),
    ], 'bugfix');
    const withTest = await draftWith(ctx, [
      op('The spec is right; the code is wrong.', { type: 'reaffirm', claim: 'c12', baseText: 'Owners invite members by email.' }),
      addCriterion,
    ], 'bugfix');

    await expect(applyChangeHandler(asCtx(ctx), { changeId: without })).rejects.toThrow('A bug fix needs at least one added acceptance criterion');
    expect(await applyChangeHandler(asCtx(ctx), { changeId: withTest })).toEqual({ status: 'applied', addedClaimIds: ['REQ-0015'] });
    expect(ctx.__tables.claims.get('c12')?.text).toBe('Owners invite members by email.');
  });

  it('refuses an empty change, a change applied twice, and an addition to a phase with no document', async () => {
    const ctx = makeCtx();
    const empty = await draftWith(ctx, []);
    await expect(applyChangeHandler(asCtx(ctx), { changeId: empty })).rejects.toThrow('A change needs at least one operation');

    const once = await draftWith(ctx, [rewordEmail]);
    await applyChangeHandler(asCtx(ctx), { changeId: once });
    await expect(applyChangeHandler(asCtx(ctx), { changeId: once })).rejects.toThrow('Only a draft change can be applied');

    ctx.__tables.artifacts.delete('stories-doc');
    const noDocument = await draftWith(ctx, [addCriterion]);
    await expect(applyChangeHandler(asCtx(ctx), { changeId: noDocument })).rejects.toThrow('Operation 1 adds to a phase that has no document yet');
  });
});

describe('getDraftContext', () => {
  it('gives the draft the live requirements, the phases with documents and the latest file revisions', async () => {
    const ctx = makeCtx();
    const changeId = await createChangeHandler(asCtx(ctx), { ...feature, kind: 'bugfix', bug });

    expect(await getDraftContextHandler(asCtx(ctx) as never, { changeId, userId: 'owner' })).toEqual({
      kind: 'bugfix',
      title: 'Invite links',
      summary: 'Let owners share a link.',
      bug,
      claims: [{ ref: 'c12', claimId: 'REQ-0012', phaseId: 'prd', text: 'Owners invite members by email.' }],
      phasesWithDocuments: ['prd', 'stories'],
      evidence: [{ id: 'f2', locator: 'lib/invites.ts', excerpt: 'export function sendInvite' }],
    });
  });

  it("refuses someone else's change and a change that is no longer a draft", async () => {
    const ctx = makeCtx();
    const changeId = await draft(ctx);

    await expect(getDraftContextHandler(asCtx(ctx) as never, { changeId, userId: 'intruder' })).rejects.toThrow('Forbidden');
    await abandonChangeHandler(asCtx(ctx), { changeId });
    await expect(getDraftContextHandler(asCtx(ctx) as never, { changeId, userId: 'owner' })).rejects.toThrow('Only a draft change can be drafted');
  });
});
