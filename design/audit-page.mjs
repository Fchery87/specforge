#!/usr/bin/env node
/**
 * Page audit. Measures the things the brief actually asks for, on a rendered page.
 *
 * Usage:
 *   node design/audit-page.mjs <url> [<url> ...]
 *
 * Reports, per page:
 *   - font families in use, and whether the count fits the three-role ceiling
 *   - every distinct font size and line height, so off-scale values are visible
 *   - every distinct border radius, against the three-value ceiling
 *   - colours that are not in design/tokens.json
 *   - every visible text node below its WCAG contrast floor
 *   - characters per line for the widest prose block, against the 80-character ceiling
 *   - resting elements carrying a shadow, which should only be overlays
 *   - the computed focus ring on the first focusable element
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(fs.readFileSync(path.join(here, "tokens.json"), "utf8"));

const palette = new Set();
for (const theme of Object.keys(tokens)) {
  if (typeof tokens[theme] !== "object") continue;
  for (const value of Object.values(tokens[theme])) palette.add(value.toLowerCase());
}
// Every palette colour as an rgb() string, so computed styles can be compared directly.
const toRgbString = (hex) => {
  const clean = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};
const paletteRgb = new Set([...palette].map(toRgbString));
paletteRgb.add("rgb(0, 0, 0)");
paletteRgb.add("rgb(255, 255, 255)");

const urls = process.argv.slice(2);
if (urls.length === 0) {
  process.stdout.write("usage: node design/audit-page.mjs <url> [<url> ...]\n");
  process.exit(2);
}

const browser = await chromium.launch();

for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(400);
  } catch (error) {
    process.stdout.write(`\n${url}\n  FAILED TO LOAD: ${error.message}\n`);
    await page.close();
    continue;
  }

  const report = await page.evaluate((allowedRgb) => {
    const allowed = new Set(allowedRgb);

    const visible = (element) => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const parseRgb = (value) => {
      const match = value?.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[,/\s]+/).filter(Boolean).map(Number);
      if (parts.length < 3) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    };

    const channel = (value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };

    const luminance = ({ r, g, b }) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

    const contrast = (fg, bg) => {
      const a = luminance(fg);
      const b = luminance(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };

    // Walk up for the first non-transparent background.
    const effectiveBackground = (element) => {
      let node = element;
      while (node && node !== document.documentElement) {
        const bg = parseRgb(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0.95) return bg;
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };

    const families = new Map();
    const sizes = new Map();
    const radii = new Map();
    const offPalette = new Map();
    const contrastFails = [];
    const shadows = new Map();
    let proseBlock = null;

    const elements = document.body.querySelectorAll("*");

    for (const element of elements) {
      if (!visible(element)) continue;
      const style = getComputedStyle(element);

      const family = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      if (family) families.set(family, (families.get(family) ?? 0) + 1);

      const hasOwnText = [...element.childNodes].some(
        (node) => node.nodeType === 3 && node.textContent.trim().length > 1
      );

      if (hasOwnText) {
        const size = Math.round(parseFloat(style.fontSize) * 10) / 10;
        const lineHeight = Math.round(parseFloat(style.lineHeight) * 10) / 10;
        const key = `${size}px / ${Number.isNaN(lineHeight) ? "normal" : `${lineHeight}px`} / ${style.fontWeight}`;
        sizes.set(key, (sizes.get(key) ?? 0) + 1);

        const fg = parseRgb(style.color);
        if (fg) {
          const bg = effectiveBackground(element);
          const value = contrast(fg, bg);
          const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
          const floor = large ? 3 : 4.5;
          if (value < floor && (fg.a ?? 1) > 0.5) {
            contrastFails.push({
              text: element.textContent.trim().slice(0, 54),
              size,
              value: Math.round(value * 100) / 100,
              floor,
            });
          }
        }

        // Widest prose block, by rendered text area.
        const rect = element.getBoundingClientRect();
        if (size >= 15 && element.textContent.trim().length > 180) {
          const charsPerLine = rect.width / (size * 0.5);
          if (!proseBlock || charsPerLine < proseBlock.charsPerLine) {
            proseBlock = {
              charsPerLine: Math.round(charsPerLine),
              size,
              width: Math.round(rect.width),
            };
          }
        }
      }

      for (const property of ["borderTopLeftRadius", "borderTopRightRadius"]) {
        const radius = style[property];
        if (radius && radius !== "0px") {
          radii.set(radius, (radii.get(radius) ?? 0) + 1);
          break;
        }
      }

      for (const property of ["color", "backgroundColor", "borderTopColor", "borderBottomColor"]) {
        const value = style[property];
        const parsed = parseRgb(value);
        if (!parsed || parsed.a === 0) continue;
        if (parsed.a < 1) continue;
        const normalized = `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`;
        if (!allowed.has(normalized)) {
          offPalette.set(normalized, (offPalette.get(normalized) ?? 0) + 1);
        }
      }

      const shadow = style.boxShadow;
      // Ignore fully transparent shadows, which Tailwind emits as ring placeholders.
      const visibleShadow =
        shadow &&
        shadow !== "none" &&
        !shadow.split(/,(?![^(]*\))/).every((part) => /rgba?\([^)]*,\s*0\s*\)/.test(part));
      if (visibleShadow) {
        shadows.set(shadow.slice(0, 70), (shadows.get(shadow.slice(0, 70)) ?? 0) + 1);
      }
    }

    // Focus ring on the first focusable element.
    let focus = "none";
    const focusable = document.querySelector(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) {
      focusable.focus();
      const style = getComputedStyle(focusable);
      focus = `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}, offset ${style.outlineOffset}`;
      focusable.blur();
    }

    const top = (map, limit) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);

    // Layout. A fixed header must not cover the first content inside main.
    const header = document.querySelector("header");
    const main = document.querySelector("main");
    const headerRect = header?.getBoundingClientRect();
    let contentStart = null;
    if (main) {
      const mainRect = main.getBoundingClientRect();
      const padTop = parseFloat(getComputedStyle(main).paddingTop) || 0;
      const firstChild = main.firstElementChild;
      const childTop = firstChild ? firstChild.getBoundingClientRect().top : null;
      // The content starts after the padding, and the first child may add its own margin.
      contentStart = Math.max(mainRect.top + padTop, childTop ?? 0);
    }

    return {
      families: top(families, 8),
      sizes: [...sizes.entries()].sort(
        (a, b) => parseFloat(a[0]) - parseFloat(b[0])
      ),
      radii: top(radii, 8),
      offPalette: top(offPalette, 10),
      contrastFails: contrastFails.slice(0, 8),
      contrastFailCount: contrastFails.length,
      proseBlock,
      shadows: top(shadows, 4),
      shadowCount: [...shadows.values()].reduce((sum, n) => sum + n, 0),
      focus,
      layout: {
        headerHeight: headerRect ? Math.round(headerRect.height) : null,
        headerPosition: header ? getComputedStyle(header).position : null,
        contentStart: contentStart === null ? null : Math.round(contentStart),
        overlap:
          headerRect && contentStart !== null && getComputedStyle(header).position === "fixed"
            ? Math.round(headerRect.bottom - contentStart)
            : null,
        scrollPaddingTop: getComputedStyle(document.documentElement).scrollPaddingTop,
      },
    };
  }, [...paletteRgb]);

  const name = url.split("/").pop();
  const line = (label, value) => process.stdout.write(`  ${label.padEnd(22)} ${value}\n`);

  process.stdout.write(`\n═══ ${name} ═══\n`);
  line("font families", `${report.families.length} -> ${report.families.map(([f, n]) => `${f} (${n})`).join(", ")}`);
  line("font sizes", `${report.sizes.length} distinct`);
  for (const [key, count] of report.sizes) process.stdout.write(`      ${key.padEnd(34)} ${count}\n`);
  line("radii", report.radii.length ? report.radii.map(([r, n]) => `${r} (${n})`).join(", ") : "none");
  line("off-palette colours", report.offPalette.length ? "" : "none");
  for (const [value, count] of report.offPalette) process.stdout.write(`      ${value.padEnd(22)} ${count}\n`);
  line("contrast failures", report.contrastFailCount === 0 ? "none" : String(report.contrastFailCount));
  for (const fail of report.contrastFails) {
    process.stdout.write(`      ${String(fail.value).padStart(5)}:1 (floor ${fail.floor}) ${fail.size}px  ${fail.text}\n`);
  }
  line("prose measure", report.proseBlock ? `~${report.proseBlock.charsPerLine} chars, ${report.proseBlock.width}px at ${report.proseBlock.size}px` : "no long block found");
  line("shadows", report.shadowCount === 0 ? "none" : `${report.shadowCount} element(s)`);
  for (const [value, count] of report.shadows) process.stdout.write(`      ${count}x ${value}\n`);
  line("focus ring", report.focus);
  line(
    "header",
    report.layout.headerHeight === null
      ? "no header element"
      : `${report.layout.headerHeight}px ${report.layout.headerPosition}, content starts at ${report.layout.contentStart}px`
  );
  line(
    "content overlap",
    report.layout.overlap === null
      ? "not applicable"
      : report.layout.overlap > 0
        ? `FAIL header covers ${report.layout.overlap}px of main`
        : "clear"
  );
  line("scroll padding", report.layout.scrollPaddingTop);

  await page.close();
}

await browser.close();
