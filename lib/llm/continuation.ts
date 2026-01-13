export async function continueIfTruncated({
  prompt,
  complete,
  continuationPrompt,
  maxTurns,
}: {
  prompt: string;
  complete: (prompt: string) => Promise<{
    content: string;
    finishReason?: string;
  }>;
  continuationPrompt: (soFar: string) => string;
  maxTurns: number;
}): Promise<{ content: string; continued: boolean; turns: number }> {
  let content = '';
  let currentPrompt = prompt;
  let continued = false;

  for (let i = 0; i < maxTurns; i++) {
    const response = await complete(currentPrompt);
    content = content ? `${content}\n\n${response.content}` : response.content;

    if (response.finishReason !== 'length') {
      return { content, continued, turns: i + 1 };
    }

    continued = true;
    currentPrompt = continuationPrompt(content);
  }

  return { content, continued, turns: maxTurns };
}
