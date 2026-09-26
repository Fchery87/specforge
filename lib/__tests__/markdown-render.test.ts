import { describe, it, expect } from "vitest";
import {
  countSpecHeadings,
  renderMarkdownSafe,
  renderPreviewHtml,
  renderSpecHtml,
} from "../markdown-render";

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

  it("keeps tables, which specifications use for contracts and field lists", () => {
    const input = [
      "| Field | Type | Required |",
      "| --- | --- | --- |",
      "| status | enum | yes |",
    ].join("\n");
    const html = renderMarkdownSafe(input);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Field</th>");
    expect(html).toContain("<td>status</td>");
  });
});

describe("renderPreviewHtml", () => {
  it("sanitizes preview output", () => {
    const html = renderPreviewHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
  });
});

describe("renderSpecHtml", () => {
  const markdown = ["# Product requirements", "", "## 3.3 Roles", "", "Body.", "", "### 3.3.1 Archive", "", "More."].join(
    "\n"
  );

  it("gives every heading its anchor id in document order", () => {
    const html = renderSpecHtml(markdown, ["product-requirements", "33-roles", "331-archive"]);
    expect(html).toContain('<h1 id="product-requirements">');
    expect(html).toContain('<h2 id="33-roles">');
    expect(html).toContain('<h3 id="331-archive">');
  });

  it("leaves a heading alone when no id is supplied for it", () => {
    const html = renderSpecHtml(markdown, ["product-requirements"]);
    expect(html).toContain('<h1 id="product-requirements">');
    expect(html).toContain("<h2>");
    expect(html).not.toContain("id=\"undefined\"");
  });

  it("rejects an id that could not have come from the outline", () => {
    const html = renderSpecHtml(markdown, ['x" onmouseover="alert(1)', "b", "c"]);
    expect(html).not.toContain("onmouseover");
    expect(html).toContain("<h1>");
  });

  it("does not count a fence comment as a heading, so later ids stay aligned", () => {
    const withFence = [
      "# Title",
      "",
      "```bash",
      "# not a heading",
      "```",
      "",
      "## Second",
    ].join("\n");
    const html = renderSpecHtml(withFence, ["title", "second"]);
    expect(html).toContain('<h1 id="title">');
    expect(html).toContain('<h2 id="second">');
    expect(html).not.toContain('id="not-a-heading"');
  });

  it("still strips scripts", () => {
    const html = renderSpecHtml("<script>alert(1)</script>\n\n# Title", ["title"]);
    expect(html).not.toContain("<script");
  });

  it("tags a claim bullet with its state so the document can draw the spine", () => {
    const withClaim = [
      "# Spec",
      "",
      "- **C-014** [confirmed; reviewed]: A claim with evidence.",
      "- **C-015** [unresolved; pending]: A claim without it.",
    ].join("\n");
    const html = renderSpecHtml(withClaim, ["spec"], {
      "C-014": "confirmed",
      "C-015": "untraced",
    });
    expect(html).toContain('data-claim="C-014" data-state="confirmed"');
    expect(html).toContain('data-claim="C-015" data-state="untraced"');
  });

  it("leaves a claim bullet untagged when no state is known", () => {
    const withClaim = "# Spec\n\n- **C-014** [confirmed; reviewed]: A claim.";
    const html = renderSpecHtml(withClaim, ["spec"], {});
    expect(html).not.toContain("data-claim");
  });

  it("resumes the id cursor at startIndex so a split document keeps its anchors aligned", () => {
    const first = renderSpecHtml("# One\n\nProse.", ["one", "two"]);
    const second = renderSpecHtml("## Two\n\nMore prose.", ["one", "two"], undefined, 1);

    expect(first).toContain('<h1 id="one">');
    expect(second).toContain('<h2 id="two">');
    expect(second).not.toContain('id="one"');
  });
});

describe("countSpecHeadings", () => {
  it("counts the level 1 to 4 headings the html carries", () => {
    const html = renderSpecHtml("# One\n\n## Two\n\n### Three\n\n#### Four\n\nBody.", [
      "one",
      "two",
      "three",
      "four",
    ]);
    expect(countSpecHeadings(html)).toBe(4);
  });

  it("counts a heading left without an id, because it still consumed an index", () => {
    const html = renderSpecHtml("## Two", []);
    expect(html).toContain("<h2>");
    expect(countSpecHeadings(html)).toBe(1);
  });

  it("ignores a level 5 heading and a hash inside a fence", () => {
    const html = renderSpecHtml("##### Deep\n\n```bash\n# not a heading\n```", []);
    expect(countSpecHeadings(html)).toBe(0);
  });

  it("is zero for html with no headings", () => {
    expect(countSpecHeadings("<p>Just prose.</p>")).toBe(0);
  });
});
