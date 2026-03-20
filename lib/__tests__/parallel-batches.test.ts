import { describe, test, expect } from 'vitest';
import { getParallelBatches } from '../specification/dependency-graph';

describe('getParallelBatches', () => {
  test('returns phases grouped by parallelizable levels', () => {
    const batches = getParallelBatches([]);
    expect(batches[0]).toEqual(expect.arrayContaining(['constitution', 'brief']));
    expect(batches[1]).toEqual(expect.arrayContaining(['prd', 'domainModel']));
    expect(batches).toHaveLength(6);
    expect(batches[2]).toEqual(expect.arrayContaining(['specs']));
    expect(batches[3]).toEqual(expect.arrayContaining(['stories']));
    expect(batches[4]).toEqual(expect.arrayContaining(['artifacts']));
    expect(batches[5]).toEqual(expect.arrayContaining(['handoff']));
  });

  test('skips phases in skippedPhases list', () => {
    const batches = getParallelBatches(['domainModel', 'artifacts']);
    expect(batches[0]).toEqual(expect.arrayContaining(['constitution', 'brief']));
    expect(batches[1]).toEqual(['prd']); // domainModel skipped
    // Verify skipped phases don't appear in any batch
    const allPhasesInBatches = batches.flat();
    expect(allPhasesInBatches).not.toContain('domainModel');
    expect(allPhasesInBatches).not.toContain('artifacts');
    // handoff should still be present
    expect(allPhasesInBatches).toContain('handoff');
  });
});
