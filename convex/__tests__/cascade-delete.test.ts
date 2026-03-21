// convex/__tests__/cascade-delete.test.ts
import { describe, expect, it } from 'vitest';
import { deleteProjectHandler } from '../projects';

function makeCascadeCtx({
  userId,
  projectId = 'p1',
}: {
  userId: string;
  projectId?: string;
}) {
  const tables: Record<string, Map<string, any>> = {
    projects: new Map([[projectId, { _id: projectId, userId }]]),
    phases: new Map([['ph1', { _id: 'ph1', projectId }]]),
    artifacts: new Map([['a1', { _id: 'a1', projectId }]]),
    generationTasks: new Map([['gt1', { _id: 'gt1', projectId }]]),
    artifactVersions: new Map([['av1', { _id: 'av1', artifactId: 'a1' }]]),
    sectionPreferences: new Map([['sp1', { _id: 'sp1', projectId }]]),
    projectCodebase: new Map([['pc1', { _id: 'pc1', projectId }]]),
    verificationResults: new Map([['vr1', { _id: 'vr1', projectId }]]),
    tickets: new Map([['t1', { _id: 't1', projectId }]]),
  };

  const ctx: any = {
    auth: {
      getUserIdentity: async () => ({ subject: userId }),
    },
    db: {
      get: async (id: string) => {
        for (const table of Object.values(tables)) {
          if (table.has(id)) return table.get(id);
        }
        return null;
      },
      delete: async (id: string) => {
        for (const table of Object.values(tables)) {
          table.delete(id);
        }
      },
      query: (tableName: string) => ({
        withIndex: (_idx: string, _pred: any) => ({
          collect: async () => Array.from(tables[tableName]?.values() ?? []),
        }),
      }),
    },
    __state: tables,
  };

  return ctx;
}

describe('deleteProject cascade', () => {
  it('deletes all related records across all tables', async () => {
    const ctx = makeCascadeCtx({ userId: 'owner' });

    await deleteProjectHandler(ctx, { projectId: 'p1' as any });

    // All tables should be empty
    for (const [tableName, table] of Object.entries(ctx.__state)) {
      expect((table as Map<string, any>).size).toBe(0);
    }
  });
});
