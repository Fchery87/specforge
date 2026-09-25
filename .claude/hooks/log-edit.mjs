import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { readHookInput } from "./read-hook-input.mjs";

const input = readHookInput();
const filePath = input.tool_input?.file_path;

if (filePath) {
  const logDir = join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), ".claude", "logs");
  mkdirSync(logDir, { recursive: true });
  appendFileSync(join(logDir, "edits.log"), `${new Date().toISOString()} ${input.tool_name} ${filePath}\n`);
}
