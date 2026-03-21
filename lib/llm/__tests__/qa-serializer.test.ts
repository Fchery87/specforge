import { describe, test, expect } from 'vitest';
import { serializeQAPairs, deserializeQAPairs, type QAPair } from '../qa-serializer';

describe('serializeQAPairs', () => {
  test('serializes simple Q&A pairs', () => {
    const pairs: QAPair[] = [
      { question: 'What is the tech stack?', answer: 'Next.js, Convex' },
      { question: 'Who are the users?', answer: 'Developers' },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toEqual(pairs);
  });

  test('handles answers with newlines', () => {
    const pairs: QAPair[] = [
      {
        question: 'What constraints exist?',
        answer: 'Must use PostgreSQL\nMust use TypeScript\nNo MongoDB',
      },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toEqual(pairs);
  });

  test('handles questions with colons', () => {
    const pairs: QAPair[] = [
      {
        question: 'What defines success for this project: Key metrics or outcomes?',
        answer: 'Monthly active users > 10k',
      },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toEqual(pairs);
  });

  test('handles empty array', () => {
    expect(serializeQAPairs([])).toBe('');
    expect(deserializeQAPairs('')).toEqual([]);
  });

  test('filters out pairs with empty answers', () => {
    const pairs: QAPair[] = [
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: '' },
      { question: 'Q3', answer: 'A3' },
    ];
    const serialized = serializeQAPairs(pairs);
    const deserialized = deserializeQAPairs(serialized);
    expect(deserialized).toHaveLength(2);
    expect(deserialized[0].question).toBe('Q1');
    expect(deserialized[1].question).toBe('Q3');
  });
});

describe('deserializeQAPairs', () => {
  test('handles legacy colon-separated format gracefully', () => {
    const legacy = 'What is the stack?: Next.js\nWho are users?: Developers';
    const pairs = deserializeQAPairs(legacy);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].question).toBe('What is the stack?');
    expect(pairs[0].answer).toBe('Next.js');
  });

  test('returns empty array for null/undefined input', () => {
    expect(deserializeQAPairs(null as any)).toEqual([]);
    expect(deserializeQAPairs(undefined as any)).toEqual([]);
  });
});
