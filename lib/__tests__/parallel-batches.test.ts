import { describe, test, expect } from 'vitest';
import { getParallelBatches } from '../specification/dependency-graph';

describe('getParallelBatches', () => {
  test('returns phases grouped by parallelizable levels', () => {
    const batches = getParallelBatches([]);
    expect(batches[0]).toEqual(expect.arrayContaining(['constitution', 'brief']));
    expect(batches[1]).toEqual(expect.arrayContaining(['prd', 'domainModel']));
    expect(batches[2]).toEqual(['specs']);
    expect(batches[3]).toEqual(['stories']);
    expect(batches[4]).toEqual(['artifacts']);
    expect(batches[5]).toEqual(['handoff']);
  });

  test('skips phases in skippedPhases list', () => {
    const batches = getParallelBatches(['domainModel', 'artifacts']);
    expect(batches[0]).toEqual(expect.arrayContaining(['constitution', 'brief']));
    expect(batches[1]).toEqual(['prd']); // domainModel skipped
  });
});
