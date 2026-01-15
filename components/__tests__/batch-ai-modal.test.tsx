import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BatchAiModal } from '../batch-ai-modal';

const questions = [
  { id: 'q1', text: 'Question 1?', answer: 'Answer 1' },
  { id: 'q2', text: 'Question 2?', answer: 'Answer 2' },
];

const batchAnswers = [
  { questionId: 'q1', answer: 'Answer 1' },
  { questionId: 'q2', answer: 'Answer 2' },
];

describe('BatchAiModal', () => {
  it('shows a close button and removes accept-all messaging', () => {
    render(
      <BatchAiModal
        open
        onOpenChange={() => {}}
        isGenerating={false}
        currentProgress={2}
        totalQuestions={2}
        questions={questions}
        batchAnswers={batchAnswers}
        onCancel={() => {}}
        onAcceptAll={() => {}}
      />
    );

    expect(
      screen.getAllByRole('button', { name: /close/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /accept all/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/answers are saved automatically/i)
    ).toBeInTheDocument();
  });
});
