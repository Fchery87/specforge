import { spawnSync } from "node:child_process";
import { relative, isAbsolute } from "node:path";
import { readHookInput } from "./read-hook-input.mjs";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const filePath = readHookInput().tool_input?.file_path;
if (!filePath) process.exit(0);

const relPath = relative(projectDir, filePath);
if (relPath.startsWith("..") || isAbsolute(relPath) || relPath.includes("node_modules")) process.exit(0);

const CHECKS = [
  { name: "typecheck", applies: /\.tsx?$/, args: ["tsc", "-p", "tsconfig.json", "--noEmit"] },
  { name: "lint", applies: /\.(tsx?|jsx?)$/, args: ["eslint", "--max-warnings=0", relPath] },
  { name: "test", applies: /\.test\.tsx?$/, args: ["vitest", "run", relPath] },
];

const failures = [];
for (const check of CHECKS.filter(({ applies }) => applies.test(relPath))) {
  const result = spawnSync("npx", check.args, { cwd: projectDir, encoding: "utf8" });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").slice(-30).join("\n");
    failures.push(`${check.name} failed for ${relPath}:\n${output}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n\n"));
  process.exit(2);
}
