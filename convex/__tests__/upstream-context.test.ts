import { describe, test, expect } from 'vitest';
import { PHASE_DEPENDENCIES } from '../../lib/specification/dependency-graph';

describe('upstream question context', () => {
  test('specs phase depends on prd, domainModel, and constitution', () => {
    expect(PHASE_DEPENDENCIES['specs']).toContain('prd');
    expect(PHASE_DEPENDENCIES['specs']).toContain('domainModel');
    expect(PHASE_DEPENDENCIES['specs']).toContain('constitution');
  });

  test('stories phase depends on specs, prd, and constitution', () => {
    expect(PHASE_DEPENDENCIES['stories']).toContain('specs');
    expect(PHASE_DEPENDENCIES['stories']).toContain('prd');
    expect(PHASE_DEPENDENCIES['stories']).toContain('constitution');
  });

  test('brief and constitution have no dependencies', () => {
    expect(PHASE_DEPENDENCIES['brief']).toEqual([]);
    expect(PHASE_DEPENDENCIES['constitution']).toEqual([]);
  });
});
