import { describe, expect, test, vi } from 'vitest';
import { continueIfTruncated } from '../continuation';

describe('continueIfTruncated', () => {
  test('calls onTurn with each delta and aggregates content', async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce({ content: 'a', finishReason: 'length' })
      .mockResolvedValueOnce({ content: 'b', finishReason: 'stop' });

    const onTurn = vi.fn();

    const result = await continueIfTruncated({
      prompt: 'p',
      complete,
      continuationPrompt: (soFar) => `continue: ${soFar}`,
      maxTurns: 3,
      onTurn,
    });

    expect(result.content).toBe('a\n\nb');
    expect(result.continued).toBe(true);
    expect(result.turns).toBe(2);

    expect(onTurn).toHaveBeenCalledTimes(2);
    expect(onTurn).toHaveBeenNthCalledWith(1, {
      turn: 1,
      delta: 'a',
      aggregated: 'a',
      finishReason: 'length',
    });
    expect(onTurn).toHaveBeenNthCalledWith(2, {
      turn: 2,
      delta: 'b',
      aggregated: 'a\n\nb',
      finishReason: 'stop',
    });
  });
});

