import { describe, test, expect } from 'vitest';
import { canGeneratePhase } from '../specification/dependency-graph';

describe('canGeneratePhase with skipped phases', () => {
  test('skipped dependencies do not block generation', () => {
    const statuses = {
      constitution: 'ready',
      brief: 'ready',
      prd: 'ready',
      domainModel: 'skipped',
      specs: 'pending',
    };
    const result = canGeneratePhase('specs', statuses);
    expect(result.canGenerate).toBe(true);
  });
});
