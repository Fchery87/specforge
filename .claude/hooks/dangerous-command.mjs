const DANGEROUS = [
  { pattern: /\brm\s+(-\w*r\w*|--recursive)\b/, reason: "recursive rm" },
  { pattern: /\bgit\s+push\b.*(--force\b|--force-with-lease\b|\s-f\b)/, reason: "force push" },
];

const SUBSTITUTION = /\$\(((?:[^()]|\([^()]*\))*)\)|`([^`]*)`/g;
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n([\s\S]*?)(?:\n\s*\2\s*(?=\n|$)|$)/g;
const NESTED_SHELL = /\b(?:(?:ba|z|da)?sh\s+-c|eval)\s+(['"])((?:\\.|(?!\1).)*)\1/g;

function substitutionsIn(text) {
  return [...text.matchAll(SUBSTITUTION)].map((match) => match[1] ?? match[2]).join(" ; ");
}

function stripQuoted(command) {
  let result = "";
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (char === "\\") {
      result += command.slice(i, i + 2);
      i++;
    } else if (char === "'") {
      const end = command.indexOf("'", i + 1);
      i = end === -1 ? command.length : end;
      result += " ";
    } else if (char === '"') {
      let end = i + 1;
      while (end < command.length && command[end] !== '"') end += command[end] === "\\" ? 2 : 1;
      result += ` ${substitutionsIn(command.slice(i + 1, end))} `;
      i = end;
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Returns the parts of a shell command that the shell runs, with quoted text and
 * heredoc bodies removed. Command substitutions inside double quotes and unquoted
 * heredocs, and the script passed to `sh -c` or `eval`, still count as run.
 */
function executedText(command) {
  const nested = [...command.matchAll(NESTED_SHELL)].map((match) => executedText(match[2]));
  const withoutHeredocs = command.replace(HEREDOC, (_all, quote, _tag, body) =>
    quote ? " " : ` ${substitutionsIn(body)} `,
  );
  return [stripQuoted(withoutHeredocs), ...nested].join(" ; ");
}

export function findDangerousCommand(command) {
  const text = executedText(command);
  return DANGEROUS.find(({ pattern }) => pattern.test(text))?.reason ?? null;
}
