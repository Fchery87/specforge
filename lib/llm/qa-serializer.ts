const PAIR_DELIMITER = '\n---QA---\n';
const ANSWER_DELIMITER = '\n>>>ANSWER>>>\n';

export interface QAPair {
  question: string;
  answer: string;
}

/**
 * Serializes Q&A pairs into a format that safely handles newlines and colons.
 * Filters out pairs with empty answers.
 */
export function serializeQAPairs(pairs: QAPair[]): string {
  return pairs
    .filter((p) => p.answer?.trim())
    .map((p) => `${p.question}${ANSWER_DELIMITER}${p.answer}`)
    .join(PAIR_DELIMITER);
}

/**
 * Deserializes Q&A pairs. Supports both the new delimiter format and
 * the legacy "Q: A\nQ: A" format for backward compatibility.
 */
export function deserializeQAPairs(text: string | null | undefined): QAPair[] {
  if (!text?.trim()) return [];

  // New format: uses delimiters
  if (text.includes(ANSWER_DELIMITER)) {
    return text
      .split(PAIR_DELIMITER)
      .filter((block) => block.includes(ANSWER_DELIMITER))
      .map((block) => {
        const delimIndex = block.indexOf(ANSWER_DELIMITER);
        return {
          question: block.substring(0, delimIndex).trim(),
          answer: block.substring(delimIndex + ANSWER_DELIMITER.length).trim(),
        };
      })
      .filter((p) => p.question && p.answer);
  }

  // Legacy format: "Question: Answer\nQuestion: Answer"
  return text
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => {
      const colonIndex = line.indexOf(':');
      return {
        question: line.substring(0, colonIndex).trim(),
        answer: line.substring(colonIndex + 1).trim(),
      };
    })
    .filter((p) => p.question && p.answer);
}

/**
 * Formats Q&A pairs for human-readable prompt injection.
 * Used in system prompts where the LLM needs to read the Q&A as context.
 */
export function formatQAForPrompt(pairs: QAPair[]): string {
  return pairs.map((p) => `Q: ${p.question}\nA: ${p.answer}`).join('\n\n');
}
