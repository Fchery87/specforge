import { describe, it, expect } from "vitest";
import { renderMarkdownSafe, renderPreviewHtml } from "../markdown-render";

describe("renderMarkdownSafe", () => {
  it("strips script tags and unsafe attributes", () => {
    const input = "# Title\n\n<script>alert(1)</script>\n\n<a href=\"javascript:alert(1)\">x</a>";
    const html = renderMarkdownSafe(input);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("preserves safe markdown formatting", () => {
    const input = "## Heading\n\n- Item\n\n`code`";
    const html = renderMarkdownSafe(input);
    expect(html).toContain("<h2>");
    expect(html).toContain("<li>");
    expect(html).toContain("<code>");
  });
});

describe("renderPreviewHtml", () => {
  it("sanitizes preview output", () => {
    const html = renderPreviewHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
  });
});
