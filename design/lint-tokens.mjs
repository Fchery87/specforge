#!/usr/bin/env node
/**
 * Design-rule lint.
 *
 * Encodes the rules from design/brief.md so they are checked, not remembered. Two jobs:
 *   1. every colour literal belongs to the palette in design/tokens.json
 *   2. none of the retired patterns reappear (glow shadows, glass, noise, gradient decoration,
 *      arrow glyphs on links, all-caps label styling)
 *
 * Usage:
 *   node design/lint-tokens.mjs design/prototypes/*.html
 *   node design/lint-tokens.mjs app/globals.css components/**\/*.tsx
 *   node design/lint-tokens.mjs --tokens-only <files>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(fs.readFileSync(path.join(here, "tokens.json"), "utf8"));

// Colours that may appear in source. Palette plus pure black and white, which are structural.
const allowed = new Set(["#000000", "#ffffff"]);
for (const theme of ["dark", "light"]) {
  for (const value of Object.values(tokens[theme])) allowed.add(value.toLowerCase());
}

// Retired patterns. Each entry is [name, regex, why, severity].
//
// The raw-CSS form and the Tailwind utility form are both listed. The first draft matched only the
// raw CSS, which cannot fire in this codebase: the tree writes these as utilities, so
// `backdrop-blur-md` and `bg-linear-to-r` sailed through while the rule that exists to stop them
// never matched. A rule that cannot match the code it governs is worse than no rule.
const banned = [
  ["glow shadow", /box-shadow:[^;]*rgba\([^)]*,\s*0?\.\d+\s*\)[^;]*\b(?:3[0-9]|[4-9][0-9])px/, "Glows are retired. Elevation comes from hairlines.", "error"],
  ["text-shadow", /text-shadow|\bdrop-shadow-\[/, "Text shadows are retired.", "error"],
  ["glass", /backdrop-filter\s*:\s*(?:blur|saturate)|\bbackdrop-blur(?:-\w+)?\b/, "Glass is retired for content surfaces.", "error"],
  ["noise", /(?:fractalNoise|feTurbulence|noise-overlay|grain)/, "Noise and grain overlays are retired.", "error"],
  ["decorative gradient", /(?:linear|radial|conic)-gradient\((?!.*(?:mask|transparent 100%))|\bbg-(?:gradient|linear|radial|conic)\b/, "Gradients are retired as decoration. A mask fade is the only exception.", "error"],
  ["wide eyebrow tracking", /letter-spacing:\s*(?:0\.[1-9]\d*|1\d*)em/, "Tracked-out label styling is retired.", "error"],
  ["emoji or decorative glyph", /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u, "No emoji or decorative glyph in interface copy. Use an icon.", "error"],
  ["shadow on resting element", /box-shadow:\s*0\s+0\s+0\s+1px/, "Use a real border instead of a ring shadow for resting surfaces.", "warn"],
];

// An arrow glyph inside an anchor's text. Checked separately because it needs two conditions on
// one line, and a bare `>` is ordinary markup.
const arrowGlyph = /(?:→|➔|➜|⟶|⇒|»|&rarr;|&rArr;|&#8594;)/;
const anchorOpen = /<a\s/;

// Utility-scale rules. The design system allows one type scale, three radii and no tracking
// overrides, so an off-scale utility is mechanical rather than a judgement call.
//
// The arbitrary-value form is included alongside the named form. `text-[13px]` and `tracking-[0.25em]`
// are the same violation as `text-sm` and `tracking-wide`, and the migration that introduced these
// rules found most of its off-scale values written as arbitrary values.
const scaleRules = [
  {
    name: "off-scale type size",
    pattern:
      /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b|\btext-\[[^\]]*(?:px|rem|em|clamp\()/,
    why: "Use the scale: text-caption, text-label, text-ui, text-body, text-prose, text-title, text-heading, text-display.",
  },
  {
    name: "off-scale radius",
    // The corner modifier is matched too: `rounded-t-xl` is the same violation as `rounded-xl`, and
    // the tree already uses the modifier form, so leaving it out was a false pass.
    pattern: /\brounded(?:-[trblse]{1,2})?-(?:md|xl|2xl|3xl)\b/,
    why: "Three radii only: rounded-sm (10px) controls, rounded-lg (16px) containers, rounded-full pills.",
  },
  {
    name: "tracking override",
    pattern: /\btracking-(?:tighter|tight|wide|widest|wider)\b|\btracking-\[/,
    why: "Tracking belongs to the type scale, not to a call site.",
  },
];

// Kept separate because it sometimes needs a human call, such as a value that arrives uppercase.
const softRules = [
  {
    name: "uppercase",
    pattern: /\buppercase\b/,
    why: "Headings and labels are sentence case.",
  },
];

const files = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const tokensOnly = process.argv.includes("--tokens-only");

if (files.length === 0) {
  process.stdout.write("usage: node design/lint-tokens.mjs <files...>\n");
  process.exit(2);
}

let errors = 0;
let warnings = 0;
let hexCount = 0;

/**
 * A colour literal is 3, 4, 6 or 8 hex digits. Five and seven are not colours. The set is counted in
 * digits, excluding the leading `#`: counting it here once skipped every 6- and 8-digit colour, which
 * is a false pass rather than a false alarm.
 */
const HEX_DIGIT_COUNTS = new Set([3, 4, 6, 8]);

/**
 * Every allowlist form a literal could be written as.
 *
 * A 4-digit value is a 3-digit colour plus an alpha channel, and an 8-digit value is a 6-digit colour
 * plus alpha, so both have a base form the allowlist holds. The first draft expanded only the
 * 4-digit case and compared an 8-digit value as-is, which reported `#c87a4680` (the retired Ember accent
 * with alpha) as off-palette while its own comment claimed eight-digit forms were handled.
 *
 * Lengths are counted in digits, excluding the leading `#`, in one place so the two cases cannot
 * disagree about what they are counting.
 */
function allowlistForms(value) {
  const forms = new Set([value]);
  const digits = value.length - 1;

  if (digits === 4) {
    forms.add(`#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`);
  }
  if (digits === 8) {
    forms.add(value.slice(0, 7));
  }
  return forms;
}

/**
 * Whether a `#` on this line is a colour literal or something that merely looks like one.
 *
 * `#` also introduces an anchor fragment and a URL reference, and a ticket number in a comment. Both
 * were reported as off-palette colours by the first draft, which would block a valid change that
 * mentioned `#1234` or linked to `#a1b2c3`.
 */
function isColourContext(line, index) {
  const before = line.slice(0, index);
  if (/(?:href|xlink:href)\s*=\s*["']?$/.test(before)) return false;
  if (/url\($/.test(before)) return false;
  if (/\/\/|\/\*/.test(before)) return false;
  if (/^\s*\*/.test(before)) return false;
  return true;
}

for (const file of files) {
  if (!fs.existsSync(file)) {
    process.stdout.write(`skip  ${file} (not found)\n`);
    continue;
  }

  const source = fs.readFileSync(file, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    const where = `${file}:${index + 1}`;

    for (const match of line.matchAll(/#[0-9a-fA-F]{3,9}\b/g)) {
      const value = match[0].toLowerCase();
      if (!HEX_DIGIT_COUNTS.has(value.length - 1)) continue;
      if (allowed.has(value)) {
        hexCount += 1;
        continue;
      }
      if (!isColourContext(line, match.index)) continue;

      hexCount += 1;
      const forms = allowlistForms(value);
      if ([...forms].some((form) => allowed.has(form))) continue;

      process.stdout.write(`ERROR ${where} off-palette colour ${match[0]}\n`);
      errors += 1;
    }

    if (tokensOnly) return;

    if (arrowGlyph.test(line) && anchorOpen.test(line)) {
      errors += 1;
      process.stdout.write(`ERROR ${where} arrow on link. No arrow glyph in link text.\n`);
    }

    for (const [name, pattern, why, severity] of banned) {
      if (!pattern.test(line)) continue;
      const label = severity === "error" ? "ERROR" : "WARN ";
      if (severity === "error") errors += 1;
      else warnings += 1;
      process.stdout.write(`${label} ${where} ${name}. ${why}\n`);
    }

    for (const rule of scaleRules) {
      if (!rule.pattern.test(line)) continue;
      errors += 1;
      process.stdout.write(`ERROR ${where} ${rule.name}. ${rule.why}\n`);
    }

    for (const rule of softRules) {
      if (!rule.pattern.test(line)) continue;
      warnings += 1;
      process.stdout.write(`WARN  ${where} ${rule.name}. ${rule.why}\n`);
    }
  });
}

process.stdout.write(
  `\n${hexCount} colour literal(s) checked, ${errors} error(s), ${warnings} warning(s)\n`
);
process.exit(errors === 0 ? 0 : 1);
