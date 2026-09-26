import { describe, expect, it } from 'vitest';
import {
  EXPORT_PHASE,
  MODE_POLICIES,
  nextAction,
  PHASE_ORDER,
  PhaseStatusMap,
  ProjectMode,
  RULES_PHASE,
  stageStatus,
  WORKFLOW_STAGES,
} from './workflow';

describe('workflow stages and phases', () => {
  it('asserts the literal phaseIds of each stage', () => {
    const stageMap = Object.fromEntries(
      WORKFLOW_STAGES.map((s) => [s.id, s.phaseIds]),
    );

    expect(stageMap.requirements).toEqual(['brief', 'prd']);
    expect(stageMap.design).toEqual(['domainModel', 'specs', 'artifacts']);
    expect(stageMap.tasks).toEqual(['stories']);
  });

  it('defines labels and summaries for each stage', () => {
    expect(WORKFLOW_STAGES).toEqual([
      {
        id: 'requirements',
        label: 'Requirements',
        summary: 'What to build and why',
        phaseIds: ['brief', 'prd'],
      },
      {
        id: 'design',
        label: 'Design',
        summary: 'System architecture and data contracts',
        phaseIds: ['domainModel', 'specs', 'artifacts'],
      },
      {
        id: 'tasks',
        label: 'Tasks',
        summary: 'Implementation steps and stories',
        phaseIds: ['stories'],
      },
    ]);
  });

  it('defines special standalone phases', () => {
    expect(RULES_PHASE).toBe('constitution');
    expect(EXPORT_PHASE).toBe('handoff');
    expect(PHASE_ORDER).toHaveLength(8);
  });
});

describe('mode policies', () => {
  it('asserts that no MODE_POLICIES entry lists constitution or stories in skippedPhases', () => {
    const modes: ProjectMode[] = ['quick', 'full', 'backend'];
    for (const mode of modes) {
      const policy = MODE_POLICIES[mode];
      expect(policy.skippedPhases).not.toContain('constitution');
      expect(policy.skippedPhases).not.toContain('stories');
    }
  });

  it('matches expected mode configurations', () => {
    expect(MODE_POLICIES.quick).toEqual({
      label: 'Lite',
      reviewAfter: [],
      skippedPhases: ['domainModel', 'artifacts'],
    });

    expect(MODE_POLICIES.full).toEqual({
      label: 'Full',
      reviewAfter: ['requirements', 'design', 'tasks'],
      skippedPhases: [],
    });

    expect(MODE_POLICIES.backend).toEqual({
      label: 'Backend',
      reviewAfter: ['requirements', 'design', 'tasks'],
      skippedPhases: ['brief'],
    });
  });
});

describe('stageStatus', () => {
  const designStage = WORKFLOW_STAGES.find((s) => s.id === 'design')!;
  const requirementsStage = WORKFLOW_STAGES.find((s) => s.id === 'requirements')!;
  const tasksStage = WORKFLOW_STAGES.find((s) => s.id === 'tasks')!;

  it('asserts that stageStatus returns ready for Design when specs is ready and domainModel and artifacts are skipped', () => {
    const status = stageStatus(
      designStage,
      { specs: 'ready' },
      ['domainModel', 'artifacts'],
    );
    expect(status).toBe('ready');
  });

  it('asserts that stageStatus returns error when any enabled phase in the stage has an error', () => {
    const status = stageStatus(
      requirementsStage,
      { brief: 'ready', prd: 'error' },
      [],
    );
    expect(status).toBe('error');
  });

  it('does not return error when only a skipped phase has an error', () => {
    const status = stageStatus(
      designStage,
      { domainModel: 'error', specs: 'ready', artifacts: 'pending' },
      ['domainModel'],
    );
    expect(status).toBe('in-progress');
  });

  it('returns generating when an enabled phase is generating', () => {
    const status = stageStatus(
      requirementsStage,
      { brief: 'generating', prd: 'pending' },
      [],
    );
    expect(status).toBe('generating');
  });

  it('returns not-started when all enabled phases are pending with no answered questions', () => {
    const status = stageStatus(
      requirementsStage,
      {
        brief: { status: 'pending', questions: [{ id: '1', text: 'q', answer: '' }] },
        prd: { status: 'pending' },
      },
      [],
    );
    expect(status).toBe('not-started');
  });

  it('returns in-progress when questions have answers or some phases are ready', () => {
    const statusWithAnswer = stageStatus(
      requirementsStage,
      {
        brief: {
          status: 'pending',
          questions: [{ id: '1', text: 'q', answer: 'Some answer' }],
        },
        prd: { status: 'pending' },
      },
      [],
    );
    expect(statusWithAnswer).toBe('in-progress');

    const statusWithOneReady = stageStatus(
      requirementsStage,
      { brief: 'ready', prd: 'pending' },
      [],
    );
    expect(statusWithOneReady).toBe('in-progress');
  });

  it('handles Map and array PhaseStatusMap inputs', () => {
    const mapStatus = stageStatus(
      tasksStage,
      new Map([['stories', 'ready']]),
      [],
    );
    expect(mapStatus).toBe('ready');

    const arrayStatus = stageStatus(
      tasksStage,
      [{ phaseId: 'stories', status: 'ready' }],
      [],
    );
    expect(arrayStatus).toBe('ready');
  });
});

describe('nextAction', () => {
  it('asserts that nextAction for a new Full project returns { kind: \'answer\', phaseId: \'brief\' }', () => {
    const action = nextAction({}, [], 'full');
    expect(action).toEqual({ kind: 'answer', phaseId: 'brief' });
  });

  it('asserts that nextAction for a Full project with Requirements ready and Design not started returns { kind: \'continue\', stageId: \'design\' }', () => {
    const phases: PhaseStatusMap = {
      brief: 'ready',
      prd: 'ready',
      domainModel: 'pending',
      specs: 'pending',
      artifacts: 'pending',
      stories: 'pending',
    };
    const action = nextAction(phases, [], 'full');
    expect(action).toEqual({ kind: 'continue', stageId: 'design' });
  });

  it('asserts that nextAction for a Lite project with no answers returns { kind: \'answer\', phaseId: \'brief\' }, and that no Lite state returns review', () => {
    const liteSkipped = MODE_POLICIES.quick.skippedPhases;
    const initialAction = nextAction({}, liteSkipped, 'quick');
    expect(initialAction).toEqual({ kind: 'answer', phaseId: 'brief' });

    // Verify that across a variety of Lite project lifecycle states, review is never returned
    const liteStates: PhaseStatusMap[] = [
      {},
      { brief: 'pending' },
      {
        brief: {
          status: 'pending',
          questions: [{ id: '1', text: 'Q1', required: true, answer: 'Answer 1' }],
        },
      },
      { brief: 'ready' },
      {
        brief: 'ready',
        prd: {
          status: 'pending',
          questions: [{ id: '2', text: 'Q2', required: true, answer: 'Answer 2' }],
        },
      },
      { brief: 'ready', prd: 'ready' },
      { brief: 'ready', prd: 'ready', specs: 'pending' },
      {
        brief: 'ready',
        prd: 'ready',
        specs: {
          status: 'pending',
          questions: [{ id: '3', text: 'Q3', required: true, answer: 'Answer 3' }],
        },
      },
      { brief: 'ready', prd: 'ready', specs: 'ready' },
      { brief: 'ready', prd: 'ready', specs: 'ready', stories: 'pending' },
      {
        brief: 'ready',
        prd: 'ready',
        specs: 'ready',
        stories: {
          status: 'pending',
          questions: [{ id: '4', text: 'Q4', required: true, answer: 'Answer 4' }],
        },
      },
      { brief: 'ready', prd: 'ready', specs: 'ready', stories: 'ready' },
    ];

    for (const state of liteStates) {
      const action = nextAction(state, liteSkipped, 'quick');
      expect(action.kind).not.toBe('review');
    }
  });

  it('asserts that nextAction returns { kind: \'export\' } when every enabled phase is ready', () => {
    const fullReadyPhases: PhaseStatusMap = {
      brief: 'ready',
      prd: 'ready',
      domainModel: 'ready',
      specs: 'ready',
      artifacts: 'ready',
      stories: 'ready',
    };
    expect(nextAction(fullReadyPhases, [], 'full')).toEqual({ kind: 'export' });

    const liteReadyPhases: PhaseStatusMap = {
      brief: 'ready',
      prd: 'ready',
      specs: 'ready',
      stories: 'ready',
    };
    expect(
      nextAction(liteReadyPhases, MODE_POLICIES.quick.skippedPhases, 'quick'),
    ).toEqual({ kind: 'export' });
  });

  it('returns generate when all required questions are answered', () => {
    const phases: PhaseStatusMap = {
      brief: {
        status: 'pending',
        questions: [
          { id: '1', text: 'Required 1', required: true, answer: 'Done' },
          { id: '2', text: 'Optional 2', required: false, answer: '' },
        ],
      },
    };
    const action = nextAction(phases, [], 'full');
    expect(action).toEqual({ kind: 'generate', phaseId: 'brief' });
  });

  it('returns answer when required questions are unanswered or whitespace', () => {
    const phases: PhaseStatusMap = {
      brief: {
        status: 'pending',
        questions: [
          { id: '1', text: 'Required 1', required: true, answer: '   ' },
        ],
      },
    };
    const action = nextAction(phases, [], 'full');
    expect(action).toEqual({ kind: 'answer', phaseId: 'brief' });
  });

  it('returns continue to tasks when requirements and design are ready on Full', () => {
    const phases: PhaseStatusMap = {
      brief: 'ready',
      prd: 'ready',
      domainModel: 'ready',
      specs: 'ready',
      artifacts: 'ready',
      stories: 'pending',
    };
    const action = nextAction(phases, [], 'full');
    expect(action).toEqual({ kind: 'continue', stageId: 'tasks' });
  });

  it('handles backend mode where brief is skipped', () => {
    const backendSkipped = MODE_POLICIES.backend.skippedPhases;
    const initialAction = nextAction({}, backendSkipped, 'backend');
    expect(initialAction).toEqual({ kind: 'answer', phaseId: 'prd' });

    const requirementsReady: PhaseStatusMap = {
      prd: 'ready',
      domainModel: 'pending',
      specs: 'pending',
      artifacts: 'pending',
      stories: 'pending',
    };
    expect(nextAction(requirementsReady, backendSkipped, 'backend')).toEqual({
      kind: 'continue',
      stageId: 'design',
    });
  });

  it('works with array of phase objects as returned by Convex getProjectPhases', () => {
    const convexPhases = [
      { phaseId: 'brief', status: 'ready' as const },
      { phaseId: 'prd', status: 'ready' as const },
      { phaseId: 'domainModel', status: 'pending' as const },
    ];
    const action = nextAction(convexPhases, [], 'full');
    expect(action).toEqual({ kind: 'continue', stageId: 'design' });
  });
});
