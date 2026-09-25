import { findDangerousCommand } from "./dangerous-command.mjs";
import { readHookInput } from "./read-hook-input.mjs";

const reason = findDangerousCommand(readHookInput().tool_input?.command ?? "");

if (reason) {
  console.error(`BLOCKED (${reason}): this command requires explicit user confirmation.`);
  process.exit(2);
}
