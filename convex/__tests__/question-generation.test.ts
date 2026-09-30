import { describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';

const session = vi.hoisted(() => ({ open: vi.fn() }));

vi.mock('../actions/llmSession', async (importActual) => {
  const actual = await importActual<typeof import('../actions/llmSession')>();
  // The real session by default, so "no credentials" is the real code's own failure.
  session.open.mockImplementation(actual.openLlmSession);
  return { ...actual, openLlmSession: (ctx: unknown) => session.open(ctx) };
});
vi.mock('../rateLimiter', () => ({ rateLimiter: { limit: vi.fn(async () => undefined) } }));

import { generateQuestionsHandler } from '../actions/generateQuestions';
import { loadQuestionContext } from '../lib/question_context';

interface Fixture {
  phases: Record<string, { questions: unknown[] }>;
  claims: Record<string, Array<{ claimId: string; text: string }>>;
}

/** A ctx that answers the queries these handlers make from a fixture, and records what is written. */
function fakeCtx(fixture: Fixture) {
  const written: Array<{ phaseId: string; questions: any[] }> = [];
  const project = {
    _id: 'p1',
    userId: 'user-1',
    title: 'Atlas',
    description: 'Evidence workspace for agencies',
    constitutionTemplate: { lockedConstraints: { architecture: 'Modular monolith' } },
  };
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: 'user-1', tokenIdentifier: 'tok' }) },
    runQuery: async (ref: any, args: any) => {
      switch (getFunctionName(ref)) {
        case 'internal:getProjectInternal':
          return project;
        case 'internal:getPhaseInternal':
          return fixture.phases[args.phaseId] ?? null;
        case 'evidence:listLiveClaimIdsInternal':
          return fixture.claims[args.phaseId] ?? [];
        case 'internal:getCodebaseInternal':
          return null;
        case 'llmModels:listEnabledModelsInternal':
          return [];
        default:
          throw new Error(`unexpected query ${getFunctionName(ref)}`);
      }
    },
    runAction: async (ref: any) => {
      switch (getFunctionName(ref)) {
        case 'userConfigActions:getUserConfigInternal':
          return null;
        case 'internalActions:getAllDecryptedSystemCredentials':
          return {};
        default:
          throw new Error(`unexpected action ${getFunctionName(ref)}`);
      }
    },
    runMutation: async (ref: any, args: any) => {
      if (getFunctionName(ref) === 'internal:updatePhaseQuestionsInternal') {
        written.push({ phaseId: args.phaseId, questions: args.questions });
        return;
      }
      throw new Error(`unexpected mutation ${getFunctionName(ref)}`);
    },
  };
  return { ctx: ctx as any, project: project as any, written };
}

const answered = (id: string, text: string, answer: string, phaseId = 'brief') => ({
  id,
  text,
  answer,
  required: true,
  source: 'phase',
  feeds: [],
  answerOrigin: 'user',
  phaseId,
});

describe('loadQuestionContext', () => {
  it('holds every upstream phase for Architecture, with answers and requirements', async () => {
    const { ctx, project } = fakeCtx({
      phases: {
        constitution: { questions: [answered('q_c', 'Which stack?', 'Next.js and Convex', 'constitution')] },
        brief: { questions: [answered('q_b', 'Who is it for?', 'Agencies')] },
        prd: { questions: [answered('q_p', 'What is the goal?', 'Traceable specs', 'prd')] },
        domainModel: { questions: [] },
      },
      claims: {
        prd: [{ claimId: 'REQ-0001', text: 'An editor may archive a project.' }],
        domainModel: [{ claimId: 'REQ-0009', text: 'A project has one owner.' }],
      },
    });

    const context = await loadQuestionContext(ctx, project, 'specs');

    expect(context.upstream).toContain('[Constitution Constraints]\nArchitecture: Modular monolith');
    expect(context.upstream).toContain('Q: [constitution] Which stack?\nA: Next.js and Convex');
    expect(context.upstream).toContain('Q: [brief] Who is it for?\nA: Agencies');
    expect(context.upstream).toContain('Q: [prd] What is the goal?\nA: Traceable specs');
    expect(context.upstream).toContain('[Approved requirements in prd]\n- REQ-0001 An editor may archive a project.');
    expect(context.upstream).toContain('[Approved requirements in domainModel]\n- REQ-0009 A project has one owner.');
    expect(context.description).toBe('Evidence workspace for agencies');
  });
});

describe('generateQuestionsHandler', () => {

  it('stores the base questions, as new phase questions, when no model is configured', async () => {
    // No user key, no system credential and no enabled model, so the real session cannot open.
    const { ctx, written } = fakeCtx({ phases: {}, claims: {} });

    const result = await generateQuestionsHandler(ctx, { projectId: 'p1' as any, phaseId: 'brief' });

    expect(written).toHaveLength(1);
    expect(result.questions).toBe(written[0].questions);
    expect(written[0].questions.map((q) => q.text)).toEqual([
      'What is the primary goal of this project? What problem does it solve?',
      'Who are the target users or audience for this product?',
      'What are the key features or functionalities you want to include?',
      'Are there any specific technical constraints or requirements? (e.g., integrations, compliance)',
      'What is your expected timeline or deadline for launch?',
    ]);
    for (const question of written[0].questions) {
      expect(question).toMatchObject({ source: 'phase', feeds: [] });
      expect(question.id).toMatch(/^q_/);
    }
  });

  it('keeps an answered question, and stores the model questions with valid feeds only', async () => {
    const complete = vi.fn(async () => ({
      content: JSON.stringify({
        questions: [
          { text: 'Which markets first?', required: true, feeds: ['problem-and-objectives', 'target-audience'], suggestions: ['EU', 'US'] },
          { text: 'What must ship in v1?', feeds: ['features-and-requirements'] },
          { text: 'What defines success?', feeds: ['executive-summary'] },
          { text: 'Any compliance limits?', feeds: [] },
        ],
      }),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    }));
    session.open.mockResolvedValueOnce({ client: { complete }, modelId: 'm', model: { provider: 'test' } });
    const existing = answered('q_keep', 'Who is it for?', 'Agencies');
    const { ctx, written } = fakeCtx({
      phases: { brief: { questions: [existing, { id: 'q_old', text: 'Old?' }] } },
      claims: {},
    });

    await generateQuestionsHandler(ctx, { projectId: 'p1' as any, phaseId: 'brief' });

    const stored = written[0].questions;
    expect(stored[0]).toEqual(existing);
    expect(stored.map((q: any) => q.id)).not.toContain('q_old');
    expect(stored.slice(1).map((q: any) => [q.text, q.feeds])).toEqual([
      ['Which markets first?', ['problem-and-objectives']],
      ['What must ship in v1?', ['features-and-requirements']],
      ['What defines success?', ['executive-summary']],
      ['Any compliance limits?', []],
    ]);
    const prompt = (complete.mock.calls[0] as unknown as [string])[0];
    expect(prompt).toContain('- Who is it for?');
  });
});
