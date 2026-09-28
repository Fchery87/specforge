/**
 * The sentence a Convex function threw, without the transport wrapping. A server error reaches the
 * client as "[CONVEX M(changes:createChange)] [Request ID: …] Server Error\nUncaught Error: <sentence>
 * at handler (…)\n Called by client"; the reader needs only the sentence.
 */
export function readableError(error: unknown, fallback = "Something went wrong. Try again."): string {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const thrown = message.match(/Uncaught (?:Error|ConvexError): ([\s\S]*?)(?:\n\s+at |\n\s*Called by client|$)/);
  const sentence = (thrown?.[1] ?? message).trim();
  return sentence || fallback;
}
