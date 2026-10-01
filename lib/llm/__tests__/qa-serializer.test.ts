import { describe, test, expect } from 'vitest';
import {
  answersToAddressForSection,
  deserializeQAPairs,
  formatQAForPrompt,
  qaPairFromQuestion,
  serializeQAPairs,
  type QAPair,
} from '../qa-serializer';

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

describe('origin, feeds and phase', () => {
  test('round-trips origin, feeds and phase through the serialized text', () => {
    const pairs: QAPair[] = [
      { question: 'Who is it for?', answer: 'Agencies', origin: 'user', feeds: ['problem-and-objectives'] },
      { question: 'Multi\nline?', answer: 'Line 1\nLine 2', origin: 'drafted' },
      { question: '[brief] Goal?', answer: 'Trace', origin: 'accepted', phaseId: 'brief' },
    ];
    expect(deserializeQAPairs(serializeQAPairs(pairs))).toEqual(pairs);
  });

  test('reads a pair serialized before origins existed with no origin, feeds or phase', () => {
    const oldFormat = 'Who is it for?\n>>>ANSWER>>>\nAgencies\n---QA---\nGoal?\n>>>ANSWER>>>\nTrace';
    expect(deserializeQAPairs(oldFormat)).toEqual([
      { question: 'Who is it for?', answer: 'Agencies' },
      { question: 'Goal?', answer: 'Trace' },
    ]);
  });

  test('keeps an answer that merely looks like metadata', () => {
    const pairs: QAPair[] = [{ question: 'Q', answer: 'plain\n>>>META>>>\nnot json' }];
    expect(deserializeQAPairs(serializeQAPairs(pairs))[0].answer).toContain('not json');
  });
});

describe('qaPairFromQuestion', () => {
  const base = { id: 'q_1', text: 'Who is it for?', answer: 'Agencies' };

  test('reads the stored origin, and user when none is stored', () => {
    expect(qaPairFromQuestion({ ...base, answerOrigin: 'drafted' }).origin).toBe('drafted');
    expect(qaPairFromQuestion({ ...base, answerOrigin: 'accepted' }).origin).toBe('accepted');
    expect(qaPairFromQuestion(base).origin).toBe('user');
  });

  test('marks an upstream question with its phase and drops its feeds', () => {
    const pair = qaPairFromQuestion({ ...base, feeds: ['requirements'] }, 'brief');
    expect(pair).toEqual({ question: '[brief] Who is it for?', answer: 'Agencies', origin: 'user', phaseId: 'brief' });
  });
});

describe('formatQAForPrompt', () => {
  test('separates what the user decided from what the assistant assumed', () => {
    const text = formatQAForPrompt([
      { question: 'Typed?', answer: 'Yes', origin: 'user' },
      { question: 'Chosen?', answer: 'Chip', origin: 'accepted' },
      { question: 'Drafted?', answer: 'Guess', origin: 'drafted' },
      { question: 'Old?', answer: 'Legacy' },
    ]);
    expect(text).toBe(
      'Decided by the user:\n' +
        'Q: Typed?\nA: Yes\n\nQ: Chosen?\nA: Chip\n\nQ: Old?\nA: Legacy\n\n' +
        'Assumed by the assistant, not reviewed by the user. Treat each as a default the document may state, and mark every requirement that depends on one as an assumption:\n' +
        'Q: Drafted?\nA: Guess',
    );
  });

  test('omits a block that has nothing in it', () => {
    expect(formatQAForPrompt([{ question: 'Q', answer: 'A' }])).toBe('Decided by the user:\nQ: Q\nA: A');
    expect(formatQAForPrompt([{ question: 'Q', answer: 'A', origin: 'drafted' }])).toMatch(/^Assumed by the assistant/);
    expect(formatQAForPrompt([])).toBe('');
  });
});

describe('answersToAddressForSection', () => {
  const text = serializeQAPairs([
    { question: 'Aimed here', answer: 'A1', feeds: ['deep-modules'] },
    { question: 'Aimed elsewhere', answer: 'A2', feeds: ['test-seams'] },
    { question: 'Aimed nowhere', answer: 'A3' },
    { question: '[prd] Upstream', answer: 'A4', phaseId: 'prd' },
  ]);

  test('returns the answers that name the section plus those that name none', () => {
    expect(answersToAddressForSection(text, 'deep-modules')).toEqual([
      'Q: Aimed here\nA: A1',
      'Q: Aimed nowhere\nA: A3',
    ]);
  });

  test('sends a section split for budget the answers of its parent section', () => {
    expect(answersToAddressForSection(text, 'test-seams-part-2')).toEqual([
      'Q: Aimed elsewhere\nA: A2',
      'Q: Aimed nowhere\nA: A3',
    ]);
  });

  test('returns nothing for empty text', () => {
    expect(answersToAddressForSection('', 'deep-modules')).toEqual([]);
  });
});
