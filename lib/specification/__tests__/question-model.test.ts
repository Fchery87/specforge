import { describe, expect, it } from 'vitest';
import {
  evidenceOriginFor,
  isModelWritten,
  newQuestionId,
  originFromLegacyFlag,
} from '../question-model';

describe('answer origin', () => {
  it('records a typed answer as the user and any model-written answer as the assistant', () => {
    expect(evidenceOriginFor('user')).toBe('user');
    expect(evidenceOriginFor('accepted')).toBe('assistant');
    expect(evidenceOriginFor('drafted')).toBe('assistant');
  });

  it('reads the legacy flag as accepted, which keeps the prompt as it is today', () => {
    expect(originFromLegacyFlag(true)).toBe('accepted');
    expect(originFromLegacyFlag(false)).toBe('user');
    expect(originFromLegacyFlag(undefined)).toBeUndefined();
  });

  it('says whether the model wrote an answer', () => {
    expect(isModelWritten('user')).toBe(false);
    expect(isModelWritten('accepted')).toBe(true);
    expect(isModelWritten('drafted')).toBe(true);
    expect(isModelWritten(undefined)).toBe(false);
  });
});

describe('newQuestionId', () => {
  it('gives a prefixed id that differs on every call', () => {
    const ids = Array.from({ length: 200 }, () => newQuestionId());
    expect(new Set(ids).size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^q_[a-z0-9]{10,16}$/);
  });
});
