import { phaseLabel } from '../workflow';
import type { BaselineClaim } from './parse-draft';

export interface DraftPromptInput {
  kind: 'feature' | 'bugfix';
  title: string;
  summary: string;
  bug?: { observed: string; expected: string; reproduction: string };
  claims: readonly BaselineClaim[];
  phasesWithDocuments: readonly string[];
  evidence: ReadonlyArray<{ id: string; locator: string; excerpt: string }>;
}

export const DRAFT_SYSTEM_PROMPT =
  'You draft change specs: the smallest set of edits to an existing specification that achieves a requested change. You reply with JSON only.';

const MAX_CLAIMS = 200;

/**
 * The model sees every live requirement under its ID, grouped by phase, and answers with edits that
 * name those IDs. `parseDraft` checks every ID it returns against the same list.
 */
export function buildDraftChangePrompt(input: DraftPromptInput): string {
  const byPhase = new Map<string, BaselineClaim[]>();
  for (const claim of input.claims.slice(0, MAX_CLAIMS)) {
    byPhase.set(claim.phaseId, [...(byPhase.get(claim.phaseId) ?? []), claim]);
  }
  const requirements = [...byPhase.entries()]
    .map(([phaseId, claims]) =>
      [`${phaseLabel(phaseId)} (phase "${phaseId}"):`, ...claims.map((claim) => `- ${claim.claimId}: ${claim.text}`)].join('\n')
    )
    .join('\n\n');

  const request =
    input.kind === 'bugfix' && input.bug
      ? [
          `Bug: ${input.title}`,
          input.summary,
          `Observed: ${input.bug.observed}`,
          `Expected: ${input.bug.expected}`,
          `Steps to reproduce: ${input.bug.reproduction}`,
        ].join('\n')
      : [`Change: ${input.title}`, input.summary].join('\n');

  const evidence = input.evidence.length
    ? `Repository files you may cite by ID:\n${input.evidence
        .map((source) => `- [${source.id}] ${source.locator}: ${source.excerpt}`)
        .join('\n')}`
    : 'No repository files are connected.';

  const bugRules =
    input.kind === 'bugfix'
      ? `
This is a bug fix. Decide whether the requirement is right and the code is wrong, or the requirement itself is wrong.
- If the requirement is right, "reaffirm" it.
- If it is wrong, "modify" it.
- Always "add" at least one acceptance criterion to the "stories" phase that would have caught the bug, written as Given, When, Then.`
      : '';

  return `Draft the edits to this specification that the request needs.

Current requirements, by phase:
${requirements}

Request:
${request}

${evidence}

Reply with one JSON object and nothing else:
{"operations": [
  {"type": "add", "phase": "<phase id>", "kind": "requirement" | "acceptance_criterion" | "decision", "text": "<new requirement>", "reason": "<why>", "evidence": ["<file id>"]},
  {"type": "modify", "claimId": "<REQ id>", "text": "<new wording>", "reason": "<why>", "evidence": []},
  {"type": "remove", "claimId": "<REQ id>", "reason": "<why>"},
  {"type": "reaffirm", "claimId": "<REQ id>", "reason": "<why>"}
]}

Rules:
- Only use requirement IDs listed above. Never invent one.
- Add only to these phases: ${input.phasesWithDocuments.map((phaseId) => `"${phaseId}"`).join(', ')}.
- Make the fewest edits that achieve the request. Leave every other requirement alone.
- Every edit needs a one-sentence reason a reviewer can check.
- Cite a file ID as evidence only when the file supports the edit.${bugRules}`;
}

export const REGRESSION_REMINDER =
  'Your previous draft added no acceptance criterion. Draft again, and add at least one acceptance criterion to the "stories" phase that would have caught this bug.';
