import { describe, expect, it } from 'vitest';
import { PHASE_ORDER, WORKFLOW_STAGES, stageIdForPhase } from '../workflow';

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
