import { describe, expect, it } from 'vitest';
import { backfillQuestions, originFromLegacyFlag, remapSessionIds } from '../question-backfill';
import { answerSourceKey } from '../question-model';

const sequence = () => {
  let n = 0;
  return () => `q_new${++n}`;
};

describe('backfillQuestions', () => {
  const stored = [
    { id: 'brief-q1', text: 'Who?', answer: 'Agencies', aiGenerated: false, required: true },
    { id: 'brief-q2', text: 'Goal?', answer: 'Trace', aiGenerated: true },
    { id: 'brief-q3', text: 'Unanswered?', aiGenerated: true },
    { id: 'brief-grill-r1-q1', text: 'Retries?', answer: 'Backoff', aiGenerated: false },
  ];

  it('gives each old question a stable id, a source, feeds and an answer origin', () => {
    const result = backfillQuestions(stored, sequence());

    expect(result.migrated).toBe(4);
    expect(result.idMap).toEqual({
      'brief-q1': 'q_new1',
      'brief-q2': 'q_new2',
      'brief-q3': 'q_new3',
      'brief-grill-r1-q1': 'q_new4',
    });
    expect(result.questions).toEqual([
      { id: 'q_new1', text: 'Who?', answer: 'Agencies', required: true, source: 'phase', feeds: [], answerOrigin: 'user' },
      { id: 'q_new2', text: 'Goal?', answer: 'Trace', required: false, source: 'phase', feeds: [], answerOrigin: 'accepted' },
      { id: 'q_new3', text: 'Unanswered?', required: false, source: 'phase', feeds: [] },
      { id: 'q_new4', text: 'Retries?', answer: 'Backoff', required: false, source: 'grill', feeds: [], answerOrigin: 'user' },
    ]);
  });

  it('changes nothing on a second pass', () => {
    const first = backfillQuestions(stored, sequence());
    const second = backfillQuestions(first.questions, sequence());

    expect(second.migrated).toBe(0);
    expect(second.idMap).toEqual({});
    expect(second.questions).toEqual(first.questions);
  });

  it('leaves a question already in the current shape exactly as it is, and migrates only the old ones', () => {
    const current = { id: 'q_keep', text: 'Kept', required: false, source: 'phase' as const, feeds: ['x'] };
    const result = backfillQuestions([current, stored[0]], sequence());

    expect(result.questions[0]).toBe(current);
    expect(result.idMap).toEqual({ 'brief-q1': 'q_new1' });
  });

  it('keeps the id of a question an earlier pass already migrated, and only strips the legacy flag', () => {
    const earlier = {
      id: 'q_stay',
      text: 'Goal?',
      answer: 'Trace',
      aiGenerated: true,
      required: false,
      source: 'phase' as const,
      feeds: [],
      answerOrigin: 'drafted' as const,
    };
    const result = backfillQuestions([earlier], sequence());

    expect(result.idMap).toEqual({});
    expect(result.migrated).toBe(1);
    expect(result.questions[0]).toEqual({
      id: 'q_stay',
      text: 'Goal?',
      answer: 'Trace',
      required: false,
      source: 'phase',
      feeds: [],
      answerOrigin: 'drafted',
    });
    expect('aiGenerated' in result.questions[0]).toBe(false);
  });

  it('defaults a missing required flag to false', () => {
    const result = backfillQuestions(
      [{ id: 'q_a', text: 'A', aiGenerated: false, source: 'phase' as const, feeds: [] }],
      sequence(),
    );
    expect(result.questions[0].required).toBe(false);
  });
});

describe('originFromLegacyFlag', () => {
  it('reads the legacy flag as accepted, which keeps the prompt as it is today', () => {
    expect(originFromLegacyFlag(true)).toBe('accepted');
    expect(originFromLegacyFlag(false)).toBe('user');
    expect(originFromLegacyFlag(undefined)).toBeUndefined();
  });
});

describe('remapSessionIds', () => {
  it('moves a session question to the new id and keeps the ones it does not know', () => {
    const session = { rounds: [{ roundNumber: 1, questions: [{ id: 'old', text: 'A' }, { id: 'other', text: 'B' }] }] };
    expect(remapSessionIds(session, { old: 'q_new' }).rounds[0].questions.map((q) => q.id)).toEqual(['q_new', 'other']);
  });
});

describe('answerSourceKey', () => {
  it('matches the key the answer writers use', () => {
    expect(answerSourceKey('brief', 'q_abc')).toBe('answer:brief:q_abc');
  });
});
