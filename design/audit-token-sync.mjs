#!/usr/bin/env node
/**
 * Token sync audit.
 *
 * `design/tokens.json` is the source of record and `app/globals.css` mirrors it by hand, which is a
 * silent-drift risk: a value can be edited in one place and not the other. This compares them and
 * exits non-zero on any disagreement.
 *
 * Usage: node design/audit-token-sync.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const tokens = JSON.parse(fs.readFileSync(path.join(here, "tokens.json"), "utf8"));
const css = fs.readFileSync(path.join(repoRoot, "app/globals.css"), "utf8");

/** Token name in tokens.json to custom property in the stylesheet. */
const TOKEN_VAR = {
  ground: "--void",
  surface: "--surface",
  panel: "--panel",
  raised: "--raised",
  line: "--line",
  lineStrong: "--line-strong",
  field: "--field",
  dim: "--ink-dim",
  muted: "--ink-muted",
  text: "--ink",
  textBright: "--ink-bright",
  brand: "--brand",
  success: "--success",
  destructive: "--destructive",
  warning: "--warning",
  info: "--info",
  scrim: "--scrim",
};

/** Pull the declarations out of one block selector. */
function readBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, "m").exec(source);
  if (!match) return null;

  const values = new Map();
  for (const line of match[1].split("\n")) {
    const declaration = /^\s*(--[a-z-]+)\s*:\s*([^;]+);/.exec(line);
    if (declaration) values.set(declaration[1], declaration[2].trim());
  }
  return values;
}

const normalize = (value) => value.replace(/\s+/g, "").toLowerCase();

const blocks = {
  light: readBlock(css, ":root"),
  dark: readBlock(css, ".dark"),
};

let failures = 0;
let checked = 0;

for (const theme of ["light", "dark"]) {
  const block = blocks[theme];

  if (!block) {
    process.stdout.write(`ERROR no ${theme} block found in app/globals.css\n`);
    failures += 1;
    continue;
  }

  for (const [token, property] of Object.entries(TOKEN_VAR)) {
    const expected = tokens[theme]?.[token];
    if (expected === undefined) continue;

    const actual = block.get(property);
    checked += 1;

    if (actual === undefined) {
      process.stdout.write(`ERROR ${theme}: ${property} is missing from the stylesheet\n`);
      failures += 1;
      continue;
    }

    // A dark block may legitimately point at a light-level alias, but a literal must match.
    if (normalize(actual) !== normalize(expected)) {
      process.stdout.write(
        `ERROR ${theme}: ${property} is ${actual} in the stylesheet, ${expected} in tokens.json\n`
      );
      failures += 1;
    }
  }
}

process.stdout.write(
  `\n${checked} token value(s) compared across both themes. ${failures} mismatch(es).\n`
);

process.exit(failures === 0 ? 0 : 1);
