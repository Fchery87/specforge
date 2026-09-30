import { describe, expect, it } from 'vitest';
import { backfillPageHandler } from '../questionBackfill';
import { answerSourceKey } from '../../lib/specification/question-model';

/** A db with the two tables the backfill touches, and the one index it reads. */
function fakeDb(phases: any[], sources: any[]) {
  const patches: Array<{ id: string; fields: any }> = [];
  const db = {
    query(table: string) {
      if (table === 'phases') {
        return { paginate: async () => ({ page: phases, continueCursor: 'end', isDone: true }) };
      }
      return {
        withIndex(_name: string, build: (q: any) => any) {
          const wanted: Record<string, unknown> = {};
          const q = { eq: (field: string, value: unknown) => ((wanted[field] = value), q) };
          build(q);
          return {
            collect: async () =>
              sources.filter((s) => s.projectId === wanted.projectId && s.sourceKey === wanted.sourceKey),
          };
        },
      };
    },
    patch: async (id: string, fields: any) => {
      patches.push({ id, fields });
      const target = [...phases, ...sources].find((row) => row._id === id);
      Object.assign(target, fields);
    },
  };
  return { ctx: { db } as any, patches };
}

const phase = () => ({
  _id: 'phase1',
  projectId: 'p1',
  phaseId: 'brief',
  status: 'ready',
  questions: [
    { id: 'brief-q1', text: 'Who?', answer: 'Agencies', aiGenerated: false },
    { id: 'brief-q2', text: 'Unanswered?', aiGenerated: true },
  ],
  grillSession: {
    totalQuestionsAsked: 1,
    currentRound: 1,
    isComplete: false,
    rounds: [{ roundNumber: 1, questions: [{ id: 'brief-q1', text: 'Who?' }] }],
  },
});

const source = (revision: number, questionId: string) => ({
  _id: `src-${questionId}-r${revision}`,
  projectId: 'p1',
  sourceKey: answerSourceKey('brief', questionId),
  locator: `brief/${questionId}`,
  revision,
});

describe('backfillPageHandler', () => {
  it('re-keys the evidence of every revision to the new question id and counts what it touched', async () => {
    const phases = [phase()];
    const sources = [source(1, 'brief-q1'), source(2, 'brief-q1'), source(1, 'brief-q2')];
    const { ctx } = fakeDb(phases, sources);

    const result = await backfillPageHandler(ctx, { cursor: null });

    const [who, unanswered] = phases[0].questions as any[];
    expect(result).toEqual({
      continueCursor: 'end',
      isDone: true,
      counts: { phases: 1, questions: 2, evidenceSources: 3 },
    });
    expect(who).toMatchObject({ source: 'phase', feeds: [], answerOrigin: 'user' });
    expect(who.id).toMatch(/^q_/);
    expect(sources[0]).toMatchObject({ sourceKey: answerSourceKey('brief', who.id), locator: `brief/${who.id}` });
    expect(sources[1]).toMatchObject({ sourceKey: answerSourceKey('brief', who.id), revision: 2 });
    expect(sources[2].sourceKey).toBe(answerSourceKey('brief', unanswered.id));
    expect((phases[0].grillSession as any).rounds[0].questions[0].id).toBe(who.id);
  });

  it('changes nothing when run again', async () => {
    const phases = [phase()];
    const sources = [source(1, 'brief-q1')];
    const { ctx, patches } = fakeDb(phases, sources);
    await backfillPageHandler(ctx, { cursor: null });
    const settled = JSON.stringify({ phases, sources });
    patches.length = 0;

    const again = await backfillPageHandler(ctx, { cursor: null });

    expect(again.counts).toEqual({ phases: 0, questions: 0, evidenceSources: 0 });
    expect(patches).toEqual([]);
    expect(JSON.stringify({ phases, sources })).toBe(settled);
  });
});
