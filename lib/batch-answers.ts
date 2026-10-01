import { isModelWritten, type AnswerOrigin } from './specification/question-model';

export function collectBatchAnswers(
  questions: Array<{ id: string; answer?: string; answerOrigin?: AnswerOrigin }>
): Array<{ questionId: string; answer: string }> {
  return questions
    .filter((q) => isModelWritten(q.answerOrigin) && q.answer && q.answer.trim().length > 0)
    .map((q) => ({ questionId: q.id, answer: q.answer as string }));
}
