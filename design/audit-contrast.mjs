#!/usr/bin/env node
/**
 * Contrast audit for design/tokens.json.
 *
 * Every foreground/background pair the interface actually renders is listed below with the
 * WCAG 2.2 threshold it has to clear: 4.5:1 for body text, 3:1 for large text, icons, borders
 * and focus indicators.
 *
 * Usage: node design/audit-contrast.mjs
 * Exit code 1 when any pair fails, so it can gate a commit.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(fs.readFileSync(path.join(here, "tokens.json"), "utf8"));

const toRgb = (hex) => {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
};

const channel = (value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// [label, foreground token, background token, minimum ratio, why]
const pairs = [
  ["body text on ground", "text", "ground", 4.5, "body copy"],
  ["body text on surface", "text", "surface", 4.5, "panels"],
  ["body text on panel", "text", "panel", 4.5, "overlays"],
  ["body text on raised", "text", "raised", 4.5, "selected rows"],
  ["muted value on ground", "muted", "ground", 4.5, "values, descriptors"],
  ["muted value on surface", "muted", "surface", 4.5, "values in panels"],
  ["dim label on ground", "dim", "ground", 4.5, "labels, keybindings"],
  ["dim label on surface", "dim", "surface", 4.5, "labels in panels"],
  ["ember accent text on ground", "ember", "ground", 4.5, "links, active phase"],
  ["ember accent text on surface", "ember", "surface", 4.5, "active rows"],
  ["ember heading on ground", "emberSoft", "ground", 4.5, "headings, inline code"],
  ["ember heading on surface", "emberSoft", "surface", 4.5, "headings in panels"],
  ["sage on ground", "sage", "ground", 4.5, "confirmed, additions"],
  ["sage on surface", "sage", "surface", 4.5, "confirmed in panels"],
  ["brick on ground", "brick", "ground", 4.5, "failed, deletions"],
  ["brick on surface", "brick", "surface", 4.5, "failed in panels"],
  ["amber on ground", "amber", "ground", 4.5, "needs review, warnings"],
  ["amber on surface", "amber", "surface", 4.5, "warnings in panels"],
  ["slate on ground", "slate", "ground", 4.5, "metadata, keywords"],
  ["slate on surface", "slate", "surface", 4.5, "metadata in panels"],

  // Control boundaries. WCAG 1.4.11 asks 3:1 where the boundary is what identifies the control.
  ["field border on ground", "field", "ground", 3, "input boundary"],
  ["field border on surface", "field", "surface", 3, "input boundary in panels"],
  ["ember focus ring on ground", "ember", "ground", 3, "focus indicator"],
  ["ember focus ring on surface", "ember", "surface", 3, "focus indicator"],
  ["ember button label", "ground", "ember", 4.5, "label on primary button"],

  // Decorative only. A divider carries no meaning, so it only has to be visible at all.
  ["line on ground", "line", "ground", 1.2, "decorative divider"],
  ["line on surface", "line", "surface", 1.2, "decorative divider in panels"],
  ["lineStrong on ground", "lineStrong", "ground", 1.5, "grouped divider"],
  ["emberDeep track on surface", "emberDeep", "surface", 1.3, "progress track fill"],
];

let failures = 0;

for (const theme of ["dark", "light"]) {
  const values = tokens[theme];
  const rows = [];

  for (const [label, fgToken, bgToken, min, why] of pairs) {
    const fg = values[fgToken];
    const bg = values[bgToken];

    if (!fg || !bg) {
      rows.push(`  MISSING  ${label} (${fgToken} on ${bgToken})`);
      failures += 1;
      continue;
    }

    const value = ratio(fg, bg);
    const ok = value >= min;
    if (!ok) failures += 1;

    rows.push(
      `  ${ok ? "pass" : "FAIL"}  ${value.toFixed(2).padStart(5)}:1  min ${min}  ${label}  (${why})`
    );
  }

  process.stdout.write(`\n${theme.toUpperCase()}\n${rows.join("\n")}\n`);
}

process.stdout.write(
  failures === 0
    ? "\nAll pairs clear their thresholds.\n"
    : `\n${failures} pair(s) below threshold.\n`
);

process.exit(failures === 0 ? 0 : 1);
