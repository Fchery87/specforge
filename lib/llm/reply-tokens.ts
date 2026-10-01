/** The least room a reply gets: a short JSON answer still follows however long the model thinks. */
const MIN_REPLY_TOKENS = 8_000;

/**
 * Room for a reply: a quarter of the context, at least 8,000 tokens, and no more than the model
 * allows.
 *
 * Reasoning models spend this room thinking before they answer, and a reply whose room runs out
 * during the thinking arrives with no content at all. A fixed 2,000 tokens did that for the
 * clarifying questions on `deepseek-flash`: the JSON never came back, the reasoning text was parsed
 * in its place, and every project quietly got the generic questions. A pull-request check hit the
 * same wall at both 8,000 and 32,000 tokens.
 */
export function replyTokensFor(model: { contextTokens: number; maxOutputTokens: number }): number {
  const share =
    Number.isFinite(model.contextTokens) && model.contextTokens > 0
      ? Math.floor(model.contextTokens / 4)
      : MIN_REPLY_TOKENS;
  return Math.min(model.maxOutputTokens, Math.max(MIN_REPLY_TOKENS, share));
}
