import { describe, it, expect } from 'vitest';
import { parseSseStream } from '../sse-parser';

function sse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

describe('parseSseStream', () => {
  it('extracts content deltas from complete SSE events', () => {
    const buffer =
      sse({ choices: [{ delta: { content: 'Hello' } }] }) +
      sse({ choices: [{ delta: { content: ' world' } }] });
    const result = parseSseStream(buffer);
    expect(result.deltas).toEqual(['Hello', ' world']);
    expect(result.rest).toBe('');
    expect(result.done).toBe(false);
  });

  it('holds back a trailing partial line in rest', () => {
    const complete = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hi' } }] })}\n\n`;
    const partial = `data: ${JSON.stringify({ choices: [{ delta: { content: 'the' } }] }).slice(0, 10)}`;
    const result = parseSseStream(complete + partial);
    expect(result.deltas).toEqual(['Hi']);
    expect(result.rest).toBe(partial);
  });

  it('signals done on the [DONE] sentinel', () => {
    const buffer =
      sse({ choices: [{ delta: { content: 'x' } }] }) + 'data: [DONE]\n\n';
    const result = parseSseStream(buffer);
    expect(result.done).toBe(true);
    expect(result.deltas).toEqual(['x']);
  });

  it('skips keep-alive and non-JSON payloads without throwing', () => {
    const buffer = ': keep-alive\n\n' + 'data: not-json\n\n' + sse({ choices: [{ delta: { content: 'ok' } }] });
    const result = parseSseStream(buffer);
    expect(result.deltas).toEqual(['ok']);
  });

  it('reassembles streamed deltas into the full text', () => {
    const words = ['Once ', 'upon ', 'a ', 'time'];
    const buffer =
      words.map((w) => sse({ choices: [{ delta: { content: w } }] })).join('') +
      'data: [DONE]\n\n';
    const result = parseSseStream(buffer);
    expect(result.deltas.join('')).toBe('Once upon a time');
    expect(result.done).toBe(true);
  });
});
