export async function continueIfTruncated({
  prompt,
  complete,
  continuationPrompt,
  maxTurns,
  deadline,
  onTurn,
  sanitizeDelta,
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
  /**
   * Optional sanitizer applied to each turn's delta BEFORE it is appended
   * to the aggregated content. This prevents reasoning from being fed back
   * as context in the continuation prompt.
   *
   * If the sanitized delta is nearly empty (< 20 chars) on turn > 0,
   * the loop aborts early — the model is stuck in a reasoning loop.
   */
  sanitizeDelta?: (raw: string) => string;
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
    let delta = response.content;

    // Inter-turn sanitization: strip reasoning before appending
    if (sanitizeDelta) {
      const cleaned = sanitizeDelta(delta);

      // Abort heuristic: if the sanitized output is nearly empty,
      // the model is outputting pure reasoning with no real content.
      // Don't feed this garbage back — break the loop.
      if (cleaned.trim().length < 20 && i > 0) {
        console.warn(
          `[continueIfTruncated] Turn ${i + 1}: sanitized delta is empty ` +
            `(${cleaned.trim().length} chars). Model stuck in reasoning loop — aborting.`,
        );
        return { content, continued, turns: i + 1 };
      }

      delta = cleaned;
    }

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
