// convex/__tests__/tickets-auth.test.ts
import { describe, expect, it } from 'vitest';

type Identity = { subject: string };

function makeTicketCtx({
  userId,
  projectUserId,
  projectId = 'p1',
  ticketId = 't1',
}: {
  userId: string;
  projectUserId: string;
  projectId?: string;
  ticketId?: string;
}) {
  const projects = new Map<string, any>([
    [projectId, { _id: projectId, userId: projectUserId }],
  ]);
  const tickets = new Map<string, any>([
    [
      ticketId,
      {
        _id: ticketId,
        projectId,
        phaseId: 'stories',
        title: 'Test ticket',
        description: 'desc',
        acceptanceCriteria: [],
        status: 'todo',
        priority: 'medium',
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  ]);

  const ctx: any = {
    auth: {
      getUserIdentity: async () =>
        userId ? ({ subject: userId } as Identity) : null,
    },
    db: {
      get: async (id: string) => projects.get(id) ?? tickets.get(id) ?? null,
      patch: async (id: string, patch: Record<string, unknown>) => {
        if (tickets.has(id)) {
          tickets.set(id, { ...tickets.get(id), ...patch });
        }
      },
      delete: async (id: string) => {
        tickets.delete(id);
      },
      insert: async (_table: string, doc: any) => {
        const id = 'tnew';
        tickets.set(id, { _id: id, ...doc });
        return id;
      },
      query: (table: string) => ({
        withIndex: (_idx: string, _pred: any) => ({
          order: (_dir: string) => ({
            collect: async () =>
              Array.from(tickets.values()).filter(
                (t) => t.projectId === projectId
              ),
          }),
          collect: async () =>
            Array.from(tickets.values()).filter(
              (t) => t.projectId === projectId
            ),
        }),
      }),
    },
    __state: { tickets },
  };

  return ctx;
}

// Import handlers after extracting them (Step 3)
import {
  updateStatusHandler,
  deleteTicketHandler,
  reorderHandler,
  insertTicketHandler,
  listByProjectHandler,
  listByPhaseHandler,
} from '../tickets';

describe('ticket authorization', () => {
  it('updateStatus throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      updateStatusHandler(ctx, { ticketId: 't1' as any, status: 'done' })
    ).rejects.toThrow('Forbidden');
  });

  it('updateStatus succeeds for correct user', async () => {
    const ctx = makeTicketCtx({ userId: 'owner', projectUserId: 'owner' });
    await updateStatusHandler(ctx, { ticketId: 't1' as any, status: 'done' });
    expect(ctx.__state.tickets.get('t1').status).toBe('done');
  });

  it('deleteTicket throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      deleteTicketHandler(ctx, { ticketId: 't1' as any })
    ).rejects.toThrow('Forbidden');
  });

  it('deleteTicket succeeds for correct user', async () => {
    const ctx = makeTicketCtx({ userId: 'owner', projectUserId: 'owner' });
    await deleteTicketHandler(ctx, { ticketId: 't1' as any });
    expect(ctx.__state.tickets.has('t1')).toBe(false);
  });

  it('reorder throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      reorderHandler(ctx, { ticketId: 't1' as any, newOrder: 5 })
    ).rejects.toThrow('Forbidden');
  });

  it('insertTicket throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      insertTicketHandler(ctx, {
        projectId: 'p1' as any,
        phaseId: 'stories',
        title: 'New',
        description: 'desc',
        acceptanceCriteria: [],
        status: 'todo',
        priority: 'medium',
        order: 1,
      })
    ).rejects.toThrow('Forbidden');
  });

  it('listByProject throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      listByProjectHandler(ctx, { projectId: 'p1' as any })
    ).rejects.toThrow('Forbidden');
  });

  it('listByPhase throws Forbidden for wrong user', async () => {
    const ctx = makeTicketCtx({ userId: 'attacker', projectUserId: 'owner' });
    await expect(
      listByPhaseHandler(ctx, { projectId: 'p1' as any, phaseId: 'stories' })
    ).rejects.toThrow('Forbidden');
  });

  it('updateStatus throws Unauthenticated when not logged in', async () => {
    const ctx = makeTicketCtx({ userId: '', projectUserId: 'owner' });
    ctx.auth.getUserIdentity = async () => null;
    await expect(
      updateStatusHandler(ctx, { ticketId: 't1' as any, status: 'done' })
    ).rejects.toThrow('Unauthenticated');
  });
});
