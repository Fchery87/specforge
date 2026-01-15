import { describe, it, expect } from 'vitest';
import { getPhaseProgressMessage } from '../notifications';

describe('getPhaseProgressMessage', () => {
  it('returns a progress description with step counts', () => {
    expect(getPhaseProgressMessage(2, 5)).toEqual({
      title: 'Phase generating',
      description: 'Generating sections 2 of 5',
    });
  });
});
