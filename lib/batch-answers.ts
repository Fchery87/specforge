export function collectBatchAnswers(
  questions: Array<{ id: string; answer?: string; aiGenerated?: boolean }>
): Array<{ questionId: string; answer: string }> {
  return questions
    .filter((q) => q.aiGenerated && q.answer && q.answer.trim().length > 0)
    .map((q) => ({ questionId: q.id, answer: q.answer as string }));
}
