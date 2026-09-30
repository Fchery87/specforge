import { describe, it, expect } from 'vitest';
import { collectBatchAnswers } from '../batch-answers';

describe('collectBatchAnswers', () => {
  it('returns only answers the assistant wrote, that have content', () => {
    const questions = [
      { id: 'q1', text: 'Question 1', answer: 'Answer 1', answerOrigin: 'drafted' as const },
      { id: 'q2', text: 'Question 2', answer: 'Answer 2', answerOrigin: 'user' as const },
      { id: 'q3', text: 'Question 3', answerOrigin: 'drafted' as const },
      { id: 'q4', text: 'Question 4', answer: 'Answer 4', answerOrigin: 'accepted' as const },
      { id: 'q5', text: 'Question 5', answer: 'Answer 5' },
    ];

    expect(collectBatchAnswers(questions)).toEqual([
      { questionId: 'q1', answer: 'Answer 1' },
      { questionId: 'q4', answer: 'Answer 4' },
    ]);
  });
});
