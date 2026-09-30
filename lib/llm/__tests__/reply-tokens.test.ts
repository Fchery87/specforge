import { describe, expect, it } from 'vitest';
import { replyTokensFor } from '../reply-tokens';

describe('replyTokensFor', () => {
  it('gives a quarter of the context', () => {
    expect(replyTokensFor({ contextTokens: 262_144, maxOutputTokens: 262_144 })).toBe(65_536);
  });

  it('gives at least 8,000 tokens, however small the context', () => {
    expect(replyTokensFor({ contextTokens: 16_000, maxOutputTokens: 100_000 })).toBe(8_000);
  });

  it('never exceeds what the model can output', () => {
    expect(replyTokensFor({ contextTokens: 1_000_000, maxOutputTokens: 32_000 })).toBe(32_000);
    expect(replyTokensFor({ contextTokens: 8_000, maxOutputTokens: 4_096 })).toBe(4_096);
  });

  it('gives the minimum when the context size is unknown', () => {
    expect(replyTokensFor({ contextTokens: 0, maxOutputTokens: 64_000 })).toBe(8_000);
    expect(replyTokensFor({ contextTokens: Number.NaN, maxOutputTokens: 64_000 })).toBe(8_000);
  });
});
