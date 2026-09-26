import { describe, test, expect } from "vitest";
import { parseSpecOutline, slugifyHeading } from "../spec-outline";

describe("slugifyHeading", () => {
  test("lowercases text and collapses non-alphanumerics to single hyphens", () => {
    expect(slugifyHeading("3.3 Roles and permissions")).toBe("3-3-roles-and-permissions");
    expect(slugifyHeading("Roles   &   Permissions")).toBe("roles-permissions");
    expect(slugifyHeading("  Trailing -- spaces  ")).toBe("trailing-spaces");
  });

  test("returns an empty string when nothing alphanumeric remains", () => {
    expect(slugifyHeading("---")).toBe("");
    expect(slugifyHeading("!!!")).toBe("");
  });
});

describe("parseSpecOutline headings", () => {
  test("parses ATX headings at level 1 through 4", () => {
    const outline = parseSpecOutline(["# One", "## Two", "### Three", "#### Four"].join("\n"));

    expect(outline.sections.map((section) => section.level)).toEqual([1, 2, 3, 4]);
    expect(outline.sections.map((section) => section.title)).toEqual(["One", "Two", "Three", "Four"]);
  });

  test("treats five or more hashes as body text, not a heading", () => {
    const outline = parseSpecOutline("# Real\n##### Not a heading\n###### Also not");

    expect(outline.sections).toHaveLength(1);
    expect(outline.sections[0].body).toContain("##### Not a heading");
    expect(outline.sections[0].body).toContain("###### Also not");
  });

  test("does not treat a hash without a following space as a heading", () => {
    const outline = parseSpecOutline("# Real\n#nospace bolt");

    expect(outline.sections).toHaveLength(1);
  });

  test("strips a closing sequence of hashes from the title", () => {
    const outline = parseSpecOutline("## Closed heading ##");

    expect(outline.sections[0].title).toBe("Closed heading");
    expect(outline.sections[0].id).toBe("closed-heading");
  });
});

describe("parseSpecOutline fenced code", () => {
  test("ignores hash characters in backtick fences", () => {
    const markdown = [
      "# Real",
      "```bash",
      "# not a heading",
      "echo hi",
      "```",
      "## After",
    ].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.title)).toEqual(["Real", "After"]);
    expect(outline.sections[0].body).toContain("# not a heading");
  });

  test("ignores hash characters in tilde fences and mermaid diagrams", () => {
    const markdown = [
      "# Real",
      "~~~mermaid",
      "graph TD",
      "  A[# root] --> B",
      "  %% a # comment",
      "~~~",
      "## After",
    ].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.title)).toEqual(["Real", "After"]);
  });

  test("closes a fence on a longer run of the same character", () => {
    const markdown = ["# Real", "```", "# inside", "`````", "## After"].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.title)).toEqual(["Real", "After"]);
  });

  test("does not close a backtick fence on a tilde line", () => {
    const markdown = ["# Real", "```", "# inside", "~~~", "## Still inside", "```", "## After"].join(
      "\n"
    );

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.title)).toEqual(["Real", "After"]);
  });
});

describe("parseSpecOutline bodies", () => {
  test("body runs from the line after the heading to the line before the next heading", () => {
    const markdown = [
      "# Parent",
      "Parent prose.",
      "",
      "## Child",
      "Child prose.",
      "",
      "### Grandchild",
      "Grandchild prose.",
    ].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.title)).toEqual([
      "Parent",
      "Child",
      "Grandchild",
    ]);
    // Non-overlapping bodies: each clause is rendered exactly once when sections are mapped in order.
    expect(outline.sections[0].body).toBe("Parent prose.");
    expect(outline.sections[1].body).toBe("Child prose.");
    expect(outline.sections[2].body).toBe("Grandchild prose.");
  });

  test("a heading with no content has an empty body", () => {
    const outline = parseSpecOutline("# First\n## Second");

    expect(outline.sections[0].body).toBe("");
    expect(outline.sections[1].body).toBe("");
  });

  test("keeps internal blank lines and complex blocks verbatim", () => {
    const markdown = [
      "# Title",
      "",
      "First paragraph.",
      "",
      "- one",
      "- two",
      "",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "## Next",
    ].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections[0].body).toBe(
      ["First paragraph.", "", "- one", "- two", "", "| a | b |", "| --- | --- |", "| 1 | 2 |"].join(
        "\n"
      )
    );
    expect(outline.sections[1].body).toBe("");
  });
});

describe("parseSpecOutline ids and numbering", () => {
  test("assigns a slug of the heading text as the id", () => {
    const outline = parseSpecOutline("# Product requirements\n## 3.3 Roles and permissions");

    expect(outline.sections.map((section) => section.id)).toEqual([
      "product-requirements",
      "3-3-roles-and-permissions",
    ]);
  });

  test("suffixes duplicate ids with -2, -3 in document order", () => {
    const outline = parseSpecOutline("# Overview\n## Overview\n### Overview\n## Overview");

    expect(outline.sections.map((section) => section.id)).toEqual([
      "overview",
      "overview-2",
      "overview-3",
      "overview-4",
    ]);
  });

  test("falls back to section plus its index when no alphanumerics remain", () => {
    const outline = parseSpecOutline("## !!!\n## ???");

    expect(outline.sections.map((section) => section.id)).toEqual(["section-0", "section-1"]);
  });

  test("extracts numeric and worded numbering and removes the separator from the title", () => {
    const markdown = [
      "# 3 Requirements",
      "## 3.3 Roles and permissions",
      "### 3.3.1 Archive",
      "## 3.3.2. Follow-up",
      "## Phase 2 Delivery",
      "### Step 4: Ship it",
      "## Unnumbered",
      "## 3D rendering",
    ].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.number)).toEqual([
      "3",
      "3.3",
      "3.3.1",
      "3.3.2",
      "Phase 2",
      "Step 4",
      null,
      null,
    ]);
    expect(outline.sections.map((section) => section.title)).toEqual([
      "Requirements",
      "Roles and permissions",
      "Archive",
      "Follow-up",
      "Delivery",
      "Ship it",
      "Unnumbered",
      "3D rendering",
    ]);
  });
});

describe("parseSpecOutline setext headings", () => {
  test("parses an equals underline as level 1 and a dash underline as level 2", () => {
    const markdown = ["Document Title", "===", "", "Section", "---", "", "Body text."].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => ({ level: section.level, title: section.title }))).toEqual([
      { level: 1, title: "Document Title" },
      { level: 2, title: "Section" },
    ]);
    expect(outline.title).toBe("Document Title");
    expect(outline.sections[0].body).toBe("");
    expect(outline.sections[1].body).toBe("Body text.");
  });

  test("does not turn a horizontal rule into a setext heading", () => {
    const markdown = ["# Title", "", "Paragraph.", "", "---", "", "More text."].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections).toHaveLength(1);
    expect(outline.sections[0].body).toContain("Paragraph.");
    expect(outline.sections[0].body).toContain("---");
    expect(outline.sections[0].body).toContain("More text.");
  });

  test("does not build a setext heading from a list item or an earlier underline", () => {
    const outline = parseSpecOutline("====\n\n- item\n---\n");

    expect(outline.sections).toHaveLength(0);
  });
});

describe("parseSpecOutline nested block structures", () => {
  test("treats markdown inside a table cell as body text", () => {
    const markdown = [
      "# Title",
      "",
      "| Field | Notes |",
      "| --- | --- |",
      "| a | ## not a heading |",
    ].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.title)).toEqual(["Title"]);
  });

  test("treats a heading marker inside a list item as body text", () => {
    const markdown = ["# Title", "", "- ## not a heading", "- second item"].join("\n");

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.title)).toEqual(["Title"]);
    expect(outline.sections[0].body).toContain("- ## not a heading");
  });

  test("treats an indented heading inside a list item as body text", () => {
    const markdown = ["# Title", "", "- item", "  #### nested heading", "", "## Real section"].join(
      "\n"
    );

    const outline = parseSpecOutline(markdown);

    expect(outline.sections.map((section) => section.title)).toEqual(["Title", "Real section"]);
  });
});

describe("parseSpecOutline degenerate input", () => {
  test("returns the fallback title and no sections for empty or whitespace-only input", () => {
    expect(parseSpecOutline("", "Fallback")).toEqual({ title: "Fallback", sections: [] });
    expect(parseSpecOutline("   \n\n\t\n  ", "Fallback")).toEqual({ title: "Fallback", sections: [] });
  });

  test("returns an empty title when no fallback is supplied", () => {
    expect(parseSpecOutline("Just a paragraph with no headings.")).toEqual({
      title: "",
      sections: [],
    });
  });

  test("does not throw on heading-free input", () => {
    expect(() => parseSpecOutline("")).not.toThrow();
    expect(() => parseSpecOutline("\n\n")).not.toThrow();
  });

  test("handles CRLF line endings", () => {
    const outline = parseSpecOutline("# Title\r\n\r\n## Section\r\n\r\nBody.\r\n");

    expect(outline.sections.map((section) => section.title)).toEqual(["Title", "Section"]);
    expect(outline.sections[1].body).toBe("Body.");
  });
});

describe("parseSpecOutline a realistic specification", () => {
  const markdown = [
    "# Product requirements",
    "",
    "The product must do the following.",
    "",
    "## 3.3 Roles and permissions",
    "",
    "Roles are defined here.",
    "",
    "### 3.3.1 Archive",
    "",
    "```mermaid",
    "graph TD",
    "  A[# root] --> B",
    "  %% # a comment",
    "```",
    "",
    "#### Archive storage",
    "",
    "Storage details.",
  ].join("\n");

  test("reports every heading once, in document order, with its id, number, and title", () => {
    const outline = parseSpecOutline(markdown);

    expect(outline.title).toBe("Product requirements");
    expect(
      outline.sections.map((section) => ({
        id: section.id,
        level: section.level,
        number: section.number,
        title: section.title,
      }))
    ).toEqual([
      { id: "product-requirements", level: 1, number: null, title: "Product requirements" },
      {
        id: "3-3-roles-and-permissions",
        level: 2,
        number: "3.3",
        title: "Roles and permissions",
      },
      { id: "3-3-1-archive", level: 3, number: "3.3.1", title: "Archive" },
      { id: "archive-storage", level: 4, number: null, title: "Archive storage" },
    ]);
  });

  test("the fenced mermaid block does not become a section", () => {
    const outline = parseSpecOutline(markdown);

    expect(outline.sections).toHaveLength(4);
    expect(
      outline.sections.some(
        (section) => section.title.includes("root") || section.title.includes("comment")
      )
    ).toBe(false);
    expect(outline.sections[2].body).toContain("```mermaid");
    expect(outline.sections[2].body).toContain("A[# root]");
    expect(outline.sections[3].body).toBe("Storage details.");
  });
});
