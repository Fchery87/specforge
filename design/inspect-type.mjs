#!/usr/bin/env node
/**
 * Find leftover traces of the old typographic system on a rendered page: forced uppercase and
 * heavy weights. Both were global rules before the redesign, so anything still matching is a
 * component nobody has migrated yet.
 *
 * Usage: node design/inspect-type.mjs <url> [<url> ...]
 */
import { chromium } from "playwright";

const urls = process.argv.slice(2);
if (urls.length === 0) {
  process.stdout.write("usage: node design/inspect-type.mjs <url> [<url> ...]\n");
  process.exit(2);
}

const browser = await chromium.launch();

for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(600);
  } catch (error) {
    process.stdout.write(`\n${url}\n  FAILED: ${error.message}\n`);
    await page.close();
    continue;
  }

  const found = await page.evaluate(() => {
    const out = [];
    for (const element of document.body.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      const weight = Number(style.fontWeight) || 400;
      const upper = style.textTransform === "uppercase";
      if (!upper && weight < 800) continue;
      if (element.getBoundingClientRect().width === 0) continue;
      if (![...element.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      out.push({
        reason: upper ? "uppercase" : `weight ${weight}`,
        tag: element.tagName.toLowerCase(),
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 46),
        size: style.fontSize,
        cls: (element.className?.toString() || "").slice(0, 90),
      });
    }
    return out;
  });

  process.stdout.write(`\n═══ ${url.split("/").pop() || url} ═══\n`);
  if (found.length === 0) {
    process.stdout.write("  clean, no uppercase and no weight above 700\n");
  }
  for (const item of found) {
    process.stdout.write(
      `  ${item.reason.padEnd(11)} ${item.size.padStart(6)}  ${item.tag.padEnd(6)} ${item.text}\n        ${item.cls}\n`
    );
  }

  await page.close();
}

await browser.close();
