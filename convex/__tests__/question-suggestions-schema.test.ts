import { describe, test, expect } from 'vitest';

describe('Question with suggestions schema', () => {
  test('question object supports suggestions array', () => {
    const question = {
      id: 'q1',
      text: 'What architecture pattern?',
      answer: undefined,
      aiGenerated: false,
      required: true,
      suggestions: ['Monolith', 'Microservices', 'Serverless', 'Modular Monolith'],
      selectedSuggestionIndex: undefined,
    };
    expect(question.suggestions).toHaveLength(4);
    expect(question.selectedSuggestionIndex).toBeUndefined();
  });
});
