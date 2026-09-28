/**
 * The JSON object in a model's reply. The reply may wrap it in prose or a code fence, so the
 * outermost braces are taken. `what` names the reply in the error, such as "draft" or "check".
 */
export function parseJsonReply(reply: string, what: string): unknown {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`The ${what} reply held no JSON object`);
  try {
    return JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new Error(`The ${what} reply was not valid JSON`);
  }
}
