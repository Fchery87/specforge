import { readHookInput } from "./read-hook-input.mjs";

const DANGEROUS = [
  { pattern: /\brm\s+(-\w*r\w*|--recursive)\b/, reason: "recursive rm" },
  { pattern: /\bgit\s+push\b.*(--force\b|--force-with-lease\b|\s-f\b)/, reason: "force push" },
];

const command = readHookInput().tool_input?.command ?? "";
const match = DANGEROUS.find(({ pattern }) => pattern.test(command));

if (match) {
  console.error(`BLOCKED (${match.reason}): this command requires explicit user confirmation.`);
  process.exit(2);
}
