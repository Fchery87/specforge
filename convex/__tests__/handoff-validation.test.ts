import { describe, test, expect } from 'vitest';
import { hasMissingRequiredAnswers } from '../actions/generatePhase';

describe('hasMissingRequiredAnswers', () => {
  test('returns false when no required questions exist', () => {
    const questions = [
      { id: 'q1', text: 'Q1' },
      { id: 'q2', text: 'Q2', answer: 'A2' },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(false);
  });

  test('returns true when required question has no answer', () => {
    const questions = [
      { id: 'q1', text: 'Q1', required: true },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(true);
  });

  test('returns false when all required questions are answered', () => {
    const questions = [
      { id: 'q1', text: 'Q1', required: true, answer: 'A1' },
      { id: 'q2', text: 'Q2' },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(false);
  });

  test('returns true when required question answer is whitespace only', () => {
    const questions = [
      { id: 'q1', text: 'Q1', required: true, answer: '   ' },
    ];
    expect(hasMissingRequiredAnswers(questions)).toBe(true);
  });
});
