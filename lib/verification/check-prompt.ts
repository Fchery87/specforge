import type { SkippedFile } from './check';
import type { DiffFile } from './diff';
import type { ScopedRequirement } from './scope';

export const CHECK_SYSTEM_PROMPT =
  'You check a code change against the requirements it must meet. You judge only from the diff you are given, you quote it exactly, and you reply with JSON only.';

/** Enough for a large PRD; the diff budget leaves room for this many. */
const MAX_CANDIDATES = 150;
const MAX_BODY_CHARS = 4_000;

export interface CheckPromptInput {
  projectTitle: string;
  pullRequest?: { title: string; body: string; commitMessages: string[] };
  /** Requirements the pull request cites. Empty means the model picks from `candidates`. */
  scope: readonly ScopedRequirement[];
  /** Every live requirement, offered when nothing is cited. */
  candidates: ReadonlyArray<{ claimId: string; text: string }>;
  reviewed: readonly DiffFile[];
  skipped: readonly SkippedFile[];
}

function requirementsBlock(input: CheckPromptInput): string {
  if (input.scope.length) {
    return [
      '## Requirements to check',
      'Give a verdict for every one of these, by ID.',
      ...input.scope.map((requirement) => `- ${requirement.claimId}: ${requirement.text}`),
    ].join('\n');
  }
  const listed = input.candidates.slice(0, MAX_CANDIDATES);
  return [
    '## Project requirements',
    'The change cites no requirement. Give a verdict only for the requirements this diff implements, changes or breaks; leave the rest out.',
    ...listed.map((requirement) => `- ${requirement.claimId}: ${requirement.text}`),
    ...(input.candidates.length > listed.length ? [`(${input.candidates.length - listed.length} more not listed)`] : []),
  ].join('\n');
}

function pullRequestBlock(pullRequest: CheckPromptInput['pullRequest']): string | null {
  if (!pullRequest) return null;
  const body = pullRequest.body.length > MAX_BODY_CHARS ? `${pullRequest.body.slice(0, MAX_BODY_CHARS)}…` : pullRequest.body;
  return [
    '## Pull request',
    `Title: ${pullRequest.title}`,
    body ? `Description:\n${body}` : null,
    pullRequest.commitMessages.length ? `Commits:\n${pullRequest.commitMessages.map((message) => `- ${message.split('\n')[0]}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCheckPrompt(input: CheckPromptInput): string {
  const diff = input.reviewed.map((file) => `### ${file.path} (${file.status})\n\`\`\`diff\n${file.patch}\n\`\`\``).join('\n\n');
  const skipped = input.skipped.length
    ? `These files changed but are not shown; do not judge them:\n${input.skipped.map((file) => `- ${file.path}`).join('\n')}`
    : null;

  return [
    `Project: ${input.projectTitle}`,
    pullRequestBlock(input.pullRequest),
    requirementsBlock(input),
    '## Diff',
    diff,
    skipped,
    `## Verdicts
- "met": the diff implements the requirement as written.
- "violated": the diff does something the requirement forbids, or contradicts it.
- "incomplete": the diff works toward the requirement but leaves part of it undone.
- "not_shown": nothing in this diff bears on the requirement either way.

Every verdict except "not_shown" must quote the diff lines it rests on: copy one or more whole lines exactly as they appear, without the leading "+", "-" or space, and name the file. A verdict you cannot support with a quoted line is "not_shown". Judge only the lines shown; do not assume what unshown code does.

Problems that break no listed requirement, such as a bug or a security hole, go under "otherFindings", not under a requirement.`,
    `## Reply format
Reply with only this JSON object:
{
  "verdicts": [
    {
      "requirement": "REQ-0012",
      "verdict": "met" | "violated" | "incomplete" | "not_shown",
      "explanation": "One or two sentences on what the diff does against the requirement.",
      "evidence": [{ "path": "path/from/the/diff.ts", "quote": "an exact line from the diff" }]
    }
  ],
  "otherFindings": [
    { "category": "bug" | "security" | "performance", "title": "Short title", "description": "What is wrong and where.", "path": "path/from/the/diff.ts" }
  ]
}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n');
}
