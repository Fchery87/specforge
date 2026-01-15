import { describe, it, expect } from 'vitest';
import { collectBatchAnswers } from '../batch-answers';

describe('collectBatchAnswers', () => {
  it('returns only AI-generated answers with content', () => {
    const questions = [
      { id: 'q1', text: 'Question 1', answer: 'Answer 1', aiGenerated: true },
      { id: 'q2', text: 'Question 2', answer: 'Answer 2', aiGenerated: false },
      { id: 'q3', text: 'Question 3', aiGenerated: true },
    ];

    expect(collectBatchAnswers(questions)).toEqual([
      { questionId: 'q1', answer: 'Answer 1' },
    ]);
  });
});
