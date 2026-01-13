import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "code",
    "pre",
    "blockquote",
    "hr",
    "br",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform(
      "a",
      { rel: "noopener noreferrer", target: "_blank" },
      true
    ),
  },
};

export function renderMarkdownSafe(markdown: string): string {
  const raw = marked.parse(markdown, { mangle: false, headerIds: false });
  return sanitizeHtml(raw, SANITIZE_OPTIONS);
}
