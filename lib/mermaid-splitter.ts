export type ContentSegment =
  | { type: 'html'; content: string }
  | { type: 'mermaid'; content: string };

/**
 * Splits a markdown string into HTML and Mermaid segments.
 * Mermaid fences (```mermaid...```) become 'mermaid' segments.
 * Everything else is rendered to HTML and returned as 'html' segments.
 */
export function splitContentByMermaid(markdown: string): ContentSegment[] {
  // Match ```mermaid ... ``` blocks (multiline)
  const MERMAID_FENCE = /```mermaid\n([\s\S]*?)```/g;
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MERMAID_FENCE.exec(markdown)) !== null) {
    const htmlPart = markdown.slice(lastIndex, match.index);
    if (htmlPart.trim()) {
      segments.push({ type: 'html', content: htmlPart });
    }
    segments.push({ type: 'mermaid', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  const remaining = markdown.slice(lastIndex);
  if (remaining.trim()) {
    segments.push({ type: 'html', content: remaining });
  }

  return segments;
}
