/**
 * The specification outline.
 *
 * One pure module: no React, no DOM, no Convex. It turns specification markdown into a flat list of
 * sections. `renderSpecHtml` anchors headings in the same document order, so a table of contents and
 * a scroll-spy built from this outline point at the right clauses.
 *
 * Reading note on `body`. Rule text can be read two ways: stop at the next heading of any level, or
 * stop only at the next heading at the same level or higher (so a parent's body contains its
 * children). This module stops at the next heading of any level, which is the literal rule and the
 * reading that keeps bodies non-overlapping: a consumer that renders, exports, or edits each section
 * in order reproduces the document exactly once, with no clause repeated. A parent's children still
 * follow it directly in `sections`, so the subtree is recoverable from the flat list.
 */

export interface SpecSection {
  /** Stable anchor id, unique within the document. */
  id: string;
  /** Heading level, 1 through 4. */
  level: number;
  /** Heading text with any leading numbering removed. */
  title: string;
  /** The numbering as written, e.g. "3.3" or "Phase 2", or null. */
  number: string | null;
  /** Raw markdown between this heading and the next heading of any level. */
  body: string;
}

export interface SpecOutline {
  /** Document title from the first level 1 heading, or the fallback. */
  title: string;
  /** Every heading in document order, flat. */
  sections: SpecSection[];
}

/** Levels 1 through 4 become sections; anything deeper is body text. */
const MAX_LEVEL = 4;

const ATX = /^ {0,3}(#{1,})([ \t]+(.*?))?[ \t]*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
/** `=` for level 1, three or more `-` for level 2. */
const SETEXT_UNDERLINE = /^ {0,3}(=+|-{3,})[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LIST_ITEM = /^([ \t]*)([-*+]|\d+[.)])(?:[ \t]+|$)/;
const DIGIT_NUMBER = /^(\d+(?:\.\d+)*)(?=\s|[:.\-]|$)/;
const WORD_NUMBER = /^(Phase|Step|Part|Stage|Section)\s+\d+(?:\.\d+)*/i;

interface Fence {
  char: string;
  length: number;
}

interface RawHeading {
  /** Line index of the heading line (the text line for a setext heading). */
  lineIndex: number;
  /** Line index of the first line of the body. */
  contentStart: number;
  level: number;
  text: string;
}

/**
 * Slug a heading into an anchor id: lowercase, every run of non-alphanumerics collapsed into a
 * single hyphen, and no leading or trailing hyphen. Returns "" when nothing alphanumeric remains;
 * the caller supplies a fallback so an id is never empty.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function leadingIndent(line: string): number {
  return /^[ \t]*/.exec(line)?.[0].length ?? 0;
}

/** Read an ATX heading line. Five or more hashes, or a hash with no space after it, are not a heading. */
function matchAtx(line: string): { level: number; text: string } | null {
  const match = ATX.exec(line);
  if (!match) return null;
  const hashes = match[1];
  if (hashes.length > MAX_LEVEL) return null;
  const afterHashes = line.slice(line.indexOf("#") + hashes.length);
  // A closing sequence of hashes is stripped, but only when a space separates it from the text.
  const text = afterHashes.replace(/[ \t]+#+[ \t]*$/, "").trim();
  return { level: hashes.length, text };
}

function matchFenceOpen(line: string): Fence | null {
  const match = FENCE_OPEN.exec(line);
  if (!match) return null;
  return { char: match[1][0], length: match[1].length };
}

function closesFence(line: string, fence: Fence): boolean {
  const match = FENCE_CLOSE.exec(line);
  if (!match) return false;
  return match[1][0] === fence.char && match[1].length >= fence.length;
}

function setextLevel(line: string): number | null {
  const match = SETEXT_UNDERLINE.exec(line);
  if (!match) return null;
  return match[1][0] === "=" ? 1 : 2;
}

function isThematicBreak(line: string): boolean {
  return THEMATIC_BREAK.test(line);
}

function stripSeparator(text: string): string {
  return text.replace(/^[\s:.\-]+/, "").trim();
}

/** Split leading numbering from a heading's text. The numbering is kept as written. */
function splitNumbering(text: string): { number: string | null; title: string } {
  const word = WORD_NUMBER.exec(text);
  if (word) {
    return { number: word[0], title: stripSeparator(text.slice(word[0].length)) };
  }
  const digit = DIGIT_NUMBER.exec(text);
  if (digit) {
    return { number: digit[1], title: stripSeparator(text.slice(digit[1].length)) };
  }
  return { number: null, title: text.trim() };
}

/** Return a unique id, suffixing `-2`, `-3`, and so on for repeats in document order. */
function uniqueId(base: string, used: Set<string>): string {
  let candidate = base;
  let counter = 1;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}`;
  }
  used.add(candidate);
  return candidate;
}

function joinBody(lines: string[], start: number, end: number): string {
  let from = start;
  let to = end;
  while (from < to && lines[from].trim() === "") from += 1;
  while (to > from && lines[to - 1].trim() === "") to -= 1;
  return lines.slice(from, to).join("\n");
}

export function parseSpecOutline(markdown: string, fallbackTitle?: string): SpecOutline {
  const fallback = fallbackTitle ?? "";
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const headings: RawHeading[] = [];
  const consumed = new Array<boolean>(lines.length).fill(false);

  let fence: Fence | null = null;
  /** Indentation of the list block we are inside, or null when outside every list. */
  let listIndent: number | null = null;

  function qualifiesAsSetextText(candidate: number): boolean {
    if (candidate < 0 || consumed[candidate]) return false;
    const previous = lines[candidate];
    const trimmed = previous.trim();
    if (trimmed === "") return false;
    if (matchAtx(previous)) return false;
    if (matchFenceOpen(previous)) return false;
    if (trimmed.startsWith("|")) return false;
    if (LIST_ITEM.test(previous)) return false;
    if (isThematicBreak(previous)) return false;
    if (setextLevel(previous) !== null) return false;
    return true;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (fence) {
      if (closesFence(line, fence)) fence = null;
      continue;
    }

    const opener = matchFenceOpen(line);
    if (opener) {
      fence = opener;
      continue;
    }

    if (line.trim() === "") continue;

    const indent = leadingIndent(line);
    const listItem = LIST_ITEM.exec(line);

    if (listItem) {
      listIndent = indent;
      continue;
    }

    if (listIndent !== null && indent > 0) {
      // Markdown that belongs to a list item stays body text.
      continue;
    }

    if (indent === 0 && listIndent !== null) {
      listIndent = null;
    }

    const atx = matchAtx(line);
    if (atx) {
      headings.push({
        lineIndex: index,
        contentStart: index + 1,
        level: atx.level,
        text: atx.text,
      });
      consumed[index] = true;
      continue;
    }

    const level = setextLevel(line);
    if (level !== null && qualifiesAsSetextText(index - 1)) {
      headings.push({
        lineIndex: index - 1,
        contentStart: index + 1,
        level,
        text: lines[index - 1].trim(),
      });
      consumed[index - 1] = true;
      consumed[index] = true;
    }
  }

  const used = new Set<string>();
  const sections: SpecSection[] = headings.map((heading, index) => {
    const { number, title } = splitNumbering(heading.text);
    const slug = slugifyHeading(heading.text);
    const base = slug === "" ? `section-${index}` : slug;
    const end = index + 1 < headings.length ? headings[index + 1].lineIndex : lines.length;
    return {
      id: uniqueId(base, used),
      level: heading.level,
      title,
      number,
      body: joinBody(lines, heading.contentStart, end),
    };
  });

  const firstLevelOne = sections.find((section) => section.level === 1);
  const title = firstLevelOne && firstLevelOne.title !== "" ? firstLevelOne.title : fallback;

  return { title, sections };
}
