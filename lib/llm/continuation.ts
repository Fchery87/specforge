export async function continueIfTruncated({
  prompt,
  complete,
  continuationPrompt,
  maxTurns,
  deadline,
  onTurn,
}: {
  prompt: string;
  complete: (prompt: string) => Promise<{
    content: string;
    finishReason?: string;
  }>;
  continuationPrompt: (soFar: string) => string;
  maxTurns: number;
  deadline?: number;
  onTurn?: (args: {
    turn: number;
    delta: string;
    aggregated: string;
    finishReason?: string;
  }) => Promise<void> | void;
}): Promise<{ content: string; continued: boolean; turns: number }> {
  let content = '';
  let currentPrompt = prompt;
  let continued = false;

  for (let i = 0; i < maxTurns; i++) {
    // Check deadline
    if (deadline && Date.now() > deadline) {
      return { content, continued, turns: i };
    }

    const response = await complete(currentPrompt);
    const delta = response.content;
    content = content ? `${content}\n\n${delta}` : delta;

    await onTurn?.({
      turn: i + 1,
      delta,
      aggregated: content,
      finishReason: response.finishReason,
    });

    if (response.finishReason !== 'length') {
      return { content, continued, turns: i + 1 };
    }

    continued = true;
    currentPrompt = continuationPrompt(content);
  }

  return { content, continued, turns: maxTurns };
}
