import { describe, expect, it } from 'vitest';
import {
  answersForSection,
  feedsLabel,
  evidenceOriginFor,
  isModelWritten,
  newQuestionId,
  sanitizeFeeds,
  sectionIdOfPlanEntry,
} from '../question-model';

describe('answer origin', () => {
  it('records a typed answer as the user and any model-written answer as the assistant', () => {
    expect(evidenceOriginFor('user')).toBe('user');
    expect(evidenceOriginFor('accepted')).toBe('assistant');
    expect(evidenceOriginFor('drafted')).toBe('assistant');
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

describe('answersForSection', () => {
  it('returns the answered questions aimed at the section and those aimed at none', () => {
    const questions = [
      { id: 'a', answer: 'x', feeds: ['deep-modules'] },
      { id: 'b', answer: 'x', feeds: ['test-seams'] },
      { id: 'c', answer: 'x', feeds: [] },
      { id: 'd', feeds: ['deep-modules'] },
      { id: 'e', answer: '  ', feeds: ['deep-modules'] },
    ];
    expect(answersForSection(questions, 'deep-modules').map((q) => q.id)).toEqual(['a', 'c']);
  });
});

describe('sectionIdOfPlanEntry', () => {
  it('strips the part suffix of a split section and nothing else', () => {
    expect(sectionIdOfPlanEntry('test-seams-part-2')).toBe('test-seams');
    expect(sectionIdOfPlanEntry('deep-modules')).toBe('deep-modules');
  });
});

describe('sanitizeFeeds', () => {
  it('keeps real section ids once each and drops the rest', () => {
    expect(sanitizeFeeds(['deep-modules', 'nope', 'deep-modules', 3], 'specs')).toEqual(['deep-modules']);
    expect(sanitizeFeeds('deep-modules', 'specs')).toEqual([]);
    expect(sanitizeFeeds(['deep-modules'], 'no-such-phase')).toEqual([]);
  });
});

describe('feedsLabel', () => {
  it('names the sections a question feeds by title', () => {
    expect(feedsLabel('specs', ['deep-modules', 'test-seams'])).toBe('Feeds Deep Module Interfaces, Explicit Test Seams');
  });

  it('says the whole document when a question names no section, and keeps an unknown id readable', () => {
    expect(feedsLabel('specs', [])).toBe('Feeds the whole document');
    expect(feedsLabel('specs', undefined)).toBe('Feeds the whole document');
    expect(feedsLabel('specs', ['retired-section'])).toBe('Feeds retired-section');
  });
});
