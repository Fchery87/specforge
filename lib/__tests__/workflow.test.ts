import { describe, expect, it } from 'vitest';
import {
  PHASE_ORDER,
  WORKFLOW_STAGES,
  currentPhaseFor,
  phaseState,
  stageIdForPhase,
  stageTargetPhase,
} from '../workflow';

describe('stageIdForPhase', () => {
  it('maps every phase in a stage to that stage', () => {
    for (const stage of WORKFLOW_STAGES) {
      for (const phaseId of stage.phaseIds) {
        expect(stageIdForPhase(phaseId)).toBe(stage.id);
      }
    }
  });

  it('is derived from WORKFLOW_STAGES rather than a second table', () => {
    // The rules phase precedes the workflow and the export phase follows it, so neither is inside a
    // stage. Every other phase belongs to exactly one, so the two can only agree.
    const staged = WORKFLOW_STAGES.flatMap((stage) => stage.phaseIds);
    const unstaged = PHASE_ORDER.filter((phaseId) => !staged.includes(phaseId));

    expect(unstaged).toEqual(['constitution', 'handoff']);
    expect(stageIdForPhase('constitution')).toBeUndefined();
    expect(stageIdForPhase('handoff')).toBeUndefined();
  });

  it('returns undefined for a phase id that does not exist', () => {
    expect(stageIdForPhase('not-a-phase')).toBeUndefined();
  });
});

describe('phaseState', () => {
  it('reads a status from any of the three map shapes', () => {
    expect(phaseState({ prd: 'ready' }, [], 'prd')).toBe('ready');
    expect(phaseState(new Map([['prd', { status: 'generating' as const }]]), [], 'prd')).toBe(
      'generating'
    );
    expect(phaseState([{ phaseId: 'prd', status: 'error' as const }], [], 'prd')).toBe('error');
  });

  it('treats a phase with no record as pending', () => {
    expect(phaseState({}, [], 'prd')).toBe('pending');
  });

  it('lets the skip list win over a stored status', () => {
    expect(phaseState({ prd: 'ready' }, ['prd'], 'prd')).toBe('skipped');
  });
});

describe('stageTargetPhase', () => {
  const requirements = WORKFLOW_STAGES[0];

  it('is the first enabled phase that is not ready', () => {
    expect(stageTargetPhase(requirements, { brief: 'ready', prd: 'pending' }, [])).toBe('prd');
  });

  it('is the first enabled phase once every enabled phase is ready', () => {
    expect(stageTargetPhase(requirements, { brief: 'ready', prd: 'ready' }, [])).toBe('brief');
  });

  it('skips a skipped phase, and falls back to the first phase when all are skipped', () => {
    expect(stageTargetPhase(requirements, { prd: 'pending' }, ['brief'])).toBe('prd');
    expect(stageTargetPhase(requirements, {}, ['brief', 'prd'])).toBe('brief');
  });
});

describe('currentPhaseFor', () => {
  it('is the phase an answer or generate action names', () => {
    expect(currentPhaseFor({ kind: 'answer', phaseId: 'prd' }, {}, [])).toBe('prd');
    expect(currentPhaseFor({ kind: 'generate', phaseId: 'specs' }, {}, [])).toBe('specs');
  });

  it("is the stage's target phase for a review or a continue", () => {
    expect(
      currentPhaseFor({ kind: 'review', stageId: 'requirements' }, { brief: 'ready', prd: 'ready' }, [])
    ).toBe('brief');
    expect(currentPhaseFor({ kind: 'continue', stageId: 'design' }, {}, ['domainModel'])).toBe(
      'specs'
    );
  });

  it('is the export phase once everything is ready', () => {
    expect(currentPhaseFor({ kind: 'export' }, {}, [])).toBe('handoff');
  });
});
