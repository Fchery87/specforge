#!/usr/bin/env node
/**
 * Design screenshot harness.
 *
 * Usage:
 *   node design/shot.mjs --label baseline
 *   node design/shot.mjs --label after --theme light --routes /
 *
 * Reads design/routes.json. Writes design/screens/<label>/<slug>-<theme>-<viewport>.png
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};

const baseUrl = argOf("url", process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000");
const label = argOf("label", "current");
const themes = argOf("theme", "dark,light").split(",").map((t) => t.trim()).filter(Boolean);
const only = argOf("routes", "").split(",").map((r) => r.trim()).filter(Boolean);

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const routeFile = path.resolve(argOf("file", path.join(here, "routes.json")));
const routes = JSON.parse(fs.readFileSync(routeFile, "utf8")).filter(
  (route) => only.length === 0 || only.includes(route.path)
);

const outDir = path.join(here, "screens", label);
fs.mkdirSync(outDir, { recursive: true });

const slugFor = (routePath, viewport) =>
  `${routePath === "/" ? "home" : routePath.replace(/^\//, "").replace(/[^\w]+/g, "-")}-${viewport}`;

const browser = await chromium.launch();
const written = [];

for (const theme of themes) {
  for (const viewportName of Object.keys(viewports)) {
    const context = await browser.newContext({
      viewport: viewports[viewportName],
      deviceScaleFactor: 1,
      colorScheme: theme,
      reducedMotion: "reduce",
    });

    await context.addInitScript((value) => {
      try {
        window.localStorage.setItem("theme", value);
      } catch {
        // localStorage can be blocked on first paint in some contexts.
      }
    }, theme);

    for (const route of routes) {
      if (route.viewports && !route.viewports.includes(viewportName)) continue;

      const page = await context.newPage();
      const target = new URL(route.path, baseUrl).toString();

      try {
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
        await page.evaluate(() => document.fonts?.ready).catch(() => {});
        await page.waitForTimeout(route.settleMs ?? 700);

        if (route.actions) {
          for (const action of route.actions) {
            if (action.wait) await page.waitForTimeout(action.wait);
          }
        }

        const file = path.join(outDir, `${slugFor(route.path, viewportName)}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: route.fullPage !== false });
        written.push(path.relative(repoRoot, file));
        process.stdout.write(`ok   ${route.path} ${viewportName} ${theme}\n`);
      } catch (error) {
        process.stdout.write(`FAIL ${route.path} ${viewportName} ${theme}: ${error.message}\n`);
      } finally {
        await page.close();
      }
    }

    await context.close();
  }
}

await browser.close();
process.stdout.write(`\n${written.length} screenshot(s) in design/screens/${label}\n`);
