/**
 * In a reply that already failed to parse, a backslash the model copied raw from a regex: one that
 * does not start an escape a quote needs. `\b` and `\f` are valid JSON, but in quoted code they are
 * a regex's word boundary and form feed far more often than a backspace, so they count as raw too.
 */
const STRAY_BACKSLASH = /\\(?!["\\/nrtu])/g;

/**
 * The JSON object in a model's reply. The reply may wrap it in prose or a code fence, so the
 * outermost braces are taken. A model quoting code often copies a regex's `\s` or `\*` into a
 * string without doubling the backslash, which JSON forbids; those are repaired and the parse is
 * tried once more. `what` names the reply in the error, such as "draft" or "check".
 */
export function parseJsonReply(reply: string, what: string): unknown {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`The ${what} reply held no JSON object`);
  const body = reply.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    try {
      return JSON.parse(body.replace(STRAY_BACKSLASH, '\\\\'));
    } catch {
      throw new Error(`The ${what} reply was not valid JSON`);
    }
  }
}
