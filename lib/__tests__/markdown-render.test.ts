import { describe, it, expect } from "vitest";
import {
  renderMarkdownSafe,
  renderPreviewHtml,
  renderSpecHtml,
} from "../markdown-render";
import { parseSpecOutline } from "../spec-outline";

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

  it("gives every heading the id the outline produced for it", () => {
    // The ids come from the outline rather than being written by hand, because a hand-written id can
    // be one the outline would never produce. This fixture used to assert `33-roles` for "3.3 Roles",
    // which `slugifyHeading` makes `3-3-roles`, so it was only passing because the old code assigned
    // ids by position and never compared them with the heading.
    const ids = parseSpecOutline(markdown).sections.map((section) => section.id);
    const html = renderSpecHtml(markdown, ids);

    expect(ids).toEqual(["product-requirements", "3-3-roles", "3-3-1-archive"]);
    expect(html).toContain('<h1 id="product-requirements">');
    expect(html).toContain('<h2 id="3-3-roles">');
    expect(html).toContain('<h3 id="3-3-1-archive">');
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
    // The cursor is gone. A piece renders correctly without knowing where it sits in the document,
    // because an id comes from the heading's own text rather than its position.
    const first = renderSpecHtml("# One\n\nProse.", ["one", "two"]);
    const second = renderSpecHtml("## Two\n\nMore prose.", ["one", "two"]);

    expect(first).toContain('<h1 id="one">');
    expect(second).toContain('<h2 id="two">');
    expect(second).not.toContain('id="one"');
  });
});

/**
 * The positional assignment this replaced handed out `headingIds[index]` in rendered-tag order while
 * `parseSpecOutline` counted a different set of headings, so one discrepancy shifted every later
 * anchor and left the last clause unlinkable. Each case below was reproduced against the old code
 * before the fix; they are the regression lock.
 */
describe("renderSpecHtml anchor alignment", () => {
  it("anchors a clause that follows a heading nested in a list item", () => {
    const markdown = [
      "# Spec",
      "",
      "- First item",
      "",
      "  ### Nested detail",
      "  Nested prose.",
      "",
      "## Second clause",
      "",
      "Body.",
    ].join("\n");

    const html = renderSpecHtml(markdown, ["spec", "second-clause"]);

    // The clause the outline counted keeps its id; the heading the outline skipped in a list body
    // does not take it.
    expect(html).toContain('<h2 id="second-clause">Second clause</h2>');
    expect(html).not.toContain('<h3 id="second-clause">');
    expect(html).toContain("<h3>Nested detail</h3>");
  });

  it("anchors a clause that follows a heading inside a blockquote", () => {
    const markdown = ["# Atlas", "", "> ## Quoted note", "", "## 2. Scope", "", "Body."].join("\n");

    const html = renderSpecHtml(markdown, ["atlas", "2-scope"]);

    expect(html).toContain('<h2 id="2-scope">2. Scope</h2>');
    expect(html).not.toContain('<h2 id="2-scope">Quoted note</h2>');
    expect(html).toContain("<h2>Quoted note</h2>");
  });

  it("anchors a clause that follows a content-authored heading with its own id", () => {
    const markdown = [
      "# Title",
      "",
      '<h2 id="raw">A raw html heading</h2>',
      "",
      "## After the diagram",
      "",
      "Body.",
    ].join("\n");

    const html = renderSpecHtml(markdown, ["title", "after-the-diagram"]);

    // The content's own id is dropped: anchor ids are ours, and a colliding one would misdirect the
    // table of contents.
    expect(html).not.toContain('id="raw"');
    expect(html).toContain('<h2 id="after-the-diagram">After the diagram</h2>');
  });

  it("suffixes a duplicate heading the way the outline suffixes it", () => {
    const html = renderSpecHtml("# Overview\n\n## Overview", ["overview", "overview-2"]);

    expect(html).toContain('<h1 id="overview">');
    expect(html).toContain('<h2 id="overview-2">');
  });

  it("leaves a heading unanchored when the outline never produced an id for it", () => {
    const html = renderSpecHtml("# Title\n\n## Not in the outline", ["title"]);

    expect(html).toContain('<h1 id="title">');
    expect(html).toContain("<h2>Not in the outline</h2>");
  });

  it("matches by text, so the same document renders the same anchors in any order", () => {
    const first = renderSpecHtml("# A\n\n## B", ["a", "b"]);
    const second = renderSpecHtml("## B\n\n# A", ["a", "b"]);

    expect(first).toContain('<h1 id="a">');
    expect(first).toContain('<h2 id="b">');
    expect(second).toContain('<h1 id="a">');
    expect(second).toContain('<h2 id="b">');
  });

  it("tags a claim bullet separated from the next by a blank line", () => {
    // `marked` renders a loose list as `<li><p><strong>`, which the first draft's regex missed, so
    // the evidence spine silently vanished for a manifest written with blank lines.
    const loose = [
      "# Spec",
      "",
      "- **C-014** [confirmed; reviewed]: One.",
      "  — Evidence: a.ts (abc123, supports)",
      "",
      "- **C-015** [confirmed; reviewed]: Two.",
      "  — Evidence: b.ts (def456, supports)",
    ].join("\n");

    const html = renderSpecHtml(loose, ["spec"], { "C-014": "confirmed", "C-015": "proposed" });

    expect(html).toContain('data-claim="C-014" data-state="confirmed"');
    expect(html).toContain('data-claim="C-015" data-state="proposed"');
  });
});
