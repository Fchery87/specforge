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
}): Promise<{ content: string }> {
  let content = '';
  let currentPrompt = prompt;

  for (let i = 0; i < maxTurns; i++) {
    const response = await complete(currentPrompt);
    content = content ? `${content}\n\n${response.content}` : response.content;

    if (response.finishReason !== 'length') {
      return { content };
    }

    currentPrompt = continuationPrompt(content);
  }

  return { content };
}
