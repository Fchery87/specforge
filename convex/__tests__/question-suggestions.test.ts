import { describe, test, expect } from 'vitest';
import { parseSuggestionsResponse } from '../actions/generateQuestionAnswer';
import { buildQuestionPrompt, normalizeQuestions, selectQuestions } from '../actions/generateQuestions';

describe('parseSuggestionsResponse', () => {
  test('parses valid JSON response with suggestedAnswer and suggestions', () => {
    const raw = JSON.stringify({
      suggestedAnswer: 'Use REST with versioned endpoints',
      suggestions: ['REST API', 'GraphQL', 'gRPC', 'REST + WebSockets'],
    });
    const result = parseSuggestionsResponse(raw);
    expect(result.suggestedAnswer).toBe('Use REST with versioned endpoints');
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toBe('REST API');
  });

  test('falls back gracefully when JSON is invalid', () => {
    const raw = 'This is not JSON at all';
    const result = parseSuggestionsResponse(raw);
    expect(result.suggestedAnswer).toBe('This is not JSON at all');
    expect(result.suggestions).toEqual([]);
  });

  test('falls back when suggestedAnswer is missing from JSON', () => {
    const raw = JSON.stringify({ suggestions: ['Option A', 'Option B'] });
    const result = parseSuggestionsResponse(raw);
    // falls back to full raw text
    expect(result.suggestedAnswer).toContain('"suggestions"');
    expect(result.suggestions).toEqual([]);
  });

  test('limits suggestions to at most 5', () => {
    const raw = JSON.stringify({
      suggestedAnswer: 'Some answer',
      suggestions: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    });
    const result = parseSuggestionsResponse(raw);
    expect(result.suggestions).toHaveLength(5);
  });

  test('filters out non-string entries in suggestions array', () => {
    const raw = JSON.stringify({
      suggestedAnswer: 'Some answer',
      suggestions: ['Valid', null, 42, 'Also valid'],
    });
    const result = parseSuggestionsResponse(raw);
    expect(result.suggestions).toEqual(['Valid', 'Also valid']);
  });

  test('extracts JSON embedded in surrounding text', () => {
    const raw = 'Here is my response: {"suggestedAnswer":"Monolith first","suggestions":["Monolith","Microservices"]} end';
    const result = parseSuggestionsResponse(raw);
    expect(result.suggestedAnswer).toBe('Monolith first');
    expect(result.suggestions).toHaveLength(2);
  });
});

describe('buildQuestionPrompt (generateQuestions)', () => {
  test('prompt includes phase and project info', () => {
    const prompt = buildQuestionPrompt({
      title: 'My App',
      description: 'A SaaS product',
      phaseId: 'brief',
      range: { min: 5, max: 8 },
    });
    expect(prompt).toContain('My App');
    expect(prompt).toContain('brief');
    expect(prompt).toContain('5-8');
  });
});

describe('selectQuestions', () => {
  test('uses AI questions when count meets minimum', () => {
    const ai = Array.from({ length: 5 }, (_, i) => ({ text: `AI Q${i}` }));
    const base = [{ text: 'Base Q1' }];
    const result = selectQuestions(ai, base, { min: 3, max: 8 });
    expect(result.aiGenerated).toBe(true);
    expect(result.questions[0].text).toBe('AI Q0');
  });

  test('falls back to base questions when AI count is below minimum', () => {
    const ai = [{ text: 'Only one AI Q' }];
    const base = Array.from({ length: 5 }, (_, i) => ({ text: `Base Q${i}` }));
    const result = selectQuestions(ai, base, { min: 3, max: 8 });
    expect(result.aiGenerated).toBe(false);
    expect(result.questions[0].text).toBe('Base Q0');
  });
});

describe('normalizeQuestions', () => {
  test('filters out questions with empty text', () => {
    const questions = [{ text: 'Valid question' }, { text: '' }, { text: '  ' }, { text: 'Another valid' }];
    const result = normalizeQuestions(questions, 'brief', { min: 1, max: 10 });
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Valid question');
  });

  test('slices to range.max', () => {
    const questions = Array.from({ length: 10 }, (_, i) => ({ text: `Q${i}` }));
    const result = normalizeQuestions(questions, 'brief', { min: 3, max: 5 });
    expect(result).toHaveLength(5);
  });
});
