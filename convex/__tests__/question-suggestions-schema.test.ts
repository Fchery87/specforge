import { describe, test, expect } from 'vitest';
import type { QuestionWithSuggestions } from '../../lib/llm/types';

describe('Question with suggestions schema', () => {
  test('question object supports suggestions array', () => {
    const question: QuestionWithSuggestions = {
      id: 'q1',
      text: 'What architecture pattern?',
      aiGenerated: false,
      required: true,
      suggestions: ['Monolith', 'Microservices', 'Serverless', 'Modular Monolith'],
    };
    expect(question.suggestions).toHaveLength(4);
    expect(question.selectedSuggestionIndex).toBeUndefined();
  });

  test('question without suggestions is valid', () => {
    const question: QuestionWithSuggestions = {
      id: 'q2',
      text: 'What is your timeline?',
      aiGenerated: false,
    };
    expect(question.suggestions).toBeUndefined();
    expect(question.selectedSuggestionIndex).toBeUndefined();
  });
});
