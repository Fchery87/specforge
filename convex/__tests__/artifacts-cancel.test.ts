import { describe, expect, it } from 'vitest';
import {
  cancelArtifactStreamingHandler,
  getArtifactByPhaseHandler,
} from '../artifacts';

type Identity = { subject: string };

function makeCtx({
  userId,
  projectUserId,
  projectId = 'p1',
  phaseId = 'brief',
  artifactId = 'a1',
  initialStreamStatus = 'streaming',
}: {
  userId: string;
  projectUserId: string;
  projectId?: string;
  phaseId?: string;
  artifactId?: string;
  initialStreamStatus?: string;
}) {
  const projects = new Map<string, any>([
    [projectId, { _id: projectId, userId: projectUserId }],
  ]);
  const artifacts = new Map<string, any>([
    [
      artifactId,
      {
        _id: artifactId,
        projectId,
        phaseId,
        streamStatus: initialStreamStatus,
      },
    ],
  ]);

  const ctx: any = {
    auth: {
      getUserIdentity: async () => ({ subject: userId } as Identity),
    },
    db: {
      get: async (id: string) => projects.get(id) ?? artifacts.get(id) ?? null,
      patch: async (id: string, patch: Record<string, unknown>) => {
        if (artifacts.has(id)) {
          artifacts.set(id, { ...artifacts.get(id), ...patch });
          return;
        }
        if (projects.has(id)) {
          projects.set(id, { ...projects.get(id), ...patch });
        }
      },
      query: (table: string) => {
        if (table !== 'artifacts') throw new Error(`Unexpected table: ${table}`);
        return {
          withIndex: (_idx: string, pred: (q: any) => any) => {
            // Accept `.eq('projectId', projectId)` style
            const q = {
              eq: (_field: string, _value: string) => q,
            };
            pred(q);
            const results = Array.from(artifacts.values()).filter(
              (a) => a.projectId === projectId
            );
            return {
              filter: (fn: (q: any) => any) => {
                const fq = {
                  field: (name: string) => name,
                  eq: (field: string, value: string) => ({ field, value }),
                };
                const cond = fn(fq) as any;
                const filtered = results.filter(
                  (a) => a[cond.field] === cond.value
                );
                return {
                  first: async () => filtered[0] ?? null,
                };
              },
              first: async () => results[0] ?? null,
            };
          },
        };
      },
    },
    __state: { artifacts },
  };

  return ctx;
}

describe('cancelArtifactStreamingHandler', () => {
  it('sets streamStatus=cancelled for the artifact in the phase', async () => {
    const ctx = makeCtx({ userId: 'u1', projectUserId: 'u1' });
    await cancelArtifactStreamingHandler(ctx, {
      projectId: 'p1' as any,
      phaseId: 'brief',
    });

    const artifact = Array.from(ctx.__state.artifacts.values())[0] as any;
    expect(artifact.streamStatus).toBe('cancelled');
  });

  it('throws Forbidden when cancelling another user project', async () => {
    const ctx = makeCtx({ userId: 'u1', projectUserId: 'u2' });
    await expect(
      cancelArtifactStreamingHandler(ctx, {
        projectId: 'p1' as any,
        phaseId: 'brief',
      })
    ).rejects.toThrow('Forbidden');
  });
});

describe('getArtifactByPhaseHandler', () => {
  it('returns the artifact for the phase', async () => {
    const ctx = makeCtx({ userId: 'u1', projectUserId: 'u1' });
    const artifact = await getArtifactByPhaseHandler(ctx, {
      projectId: 'p1' as any,
      phaseId: 'brief',
    });
    expect(artifact?._id).toBe('a1');
  });
});
