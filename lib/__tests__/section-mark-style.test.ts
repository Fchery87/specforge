import { describe, it, expect } from "vitest";
import fs from "fs";

/**
 * The `.section-mark` span `renderSpecHtml` writes has no Tailwind class to carry it, because the
 * mark is inserted into rendered HTML rather than authored in markup. Nothing defined it, so the word
 * arrived as bare text and read as part of the heading. This locks the rule in place where the rest
 * of the document notation lives, and locks it to the palette rather than a literal colour.
 */

/** The body of a CSS block, found by balancing braces so a nested rule does not end it early. */
function blockBody(source: string, header: string): string {
  const headerIndex = source.indexOf(header);
  if (headerIndex === -1) return "";

  const open = source.indexOf("{", headerIndex);
  if (open === -1) return "";

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return "";
}

const css = fs.readFileSync("app/globals.css", "utf8");
const prose = blockBody(css, "@utility document-prose");

/** The rule itself, from its selector to its closing brace. */
function sectionMarkRule(): string {
  const start = prose.indexOf("& .section-mark");
  if (start === -1) return "";
  const end = prose.indexOf("}", start);
  return end === -1 ? prose.slice(start) : prose.slice(start, end);
}

describe("the section-mark style", () => {
  it("lives inside the document-prose utility, beside the claim-bullet rules", () => {
    expect(prose).not.toBe("");
    expect(prose).toContain("& .section-mark");
  });

  it("is a caption in the sans face, so it reads as notation rather than as the heading's text", () => {
    const rule = sectionMarkRule();

    expect(rule).toContain("font-family: var(--font-sans)");
    expect(rule).toContain("font-size: var(--text-caption)");
    expect(rule).toContain("font-weight: 400");
    expect(rule).toContain("color: var(--ink-dim)");
    expect(rule).toContain("margin-inline-start");
    expect(rule).toContain("white-space: nowrap");
  });

  it("uses existing CSS variables and no literal colour", () => {
    const rule = sectionMarkRule();

    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rule).not.toContain("rgb(");
    expect(rule).not.toContain("rgba(");
    for (const declaration of rule.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
      expect(css).toContain(`${declaration[1]}:`);
    }
  });
});
