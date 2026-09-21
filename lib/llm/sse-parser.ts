/**
 * Parses Server-Sent Events text for OpenAI-compatible chat completion
 * streams. Feed each received text fragment through this parser with the
 * carried-over buffer; it returns complete content deltas and the trailing
 * partial line.
 */
export interface SseParseResult {
  deltas: string[];
  rest: string;
  done: boolean;
}

const DONE_MARKER = '[DONE]';

export function parseSseStream(buffer: string): SseParseResult {
  const deltas: string[] = [];
  let done = false;
  const parts = buffer.split('\n');
  const rest = parts.pop() ?? '';

  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice(5).trim();
    if (payload === DONE_MARKER) {
      done = true;
      continue;
    }
    if (payload === '') continue;

    try {
      const parsed = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const content = parsed.choices?.[0]?.delta?.content;
      if (typeof content === 'string' && content.length > 0) {
        deltas.push(content);
      }
    } catch {
      // Skip malformed or non-JSON keep-alive payloads
    }
  }

  return { deltas, rest, done };
}
