import { budgetDiff, diffBudgetFor } from './budget';
import {
  checkScore,
  checkStatus,
  sortVerdicts,
  type CheckCoverage,
  type CheckSource,
  type CheckStatus,
  type OtherFinding,
  type RequirementVerdict,
} from './check';
import { buildCheckPrompt } from './check-prompt';
import type { DiffFile } from './diff';
import { parseCheck } from './parse-check';
import { resolveScope, type ScopeChange, type ScopeClaim } from './scope';

/**
 * Thrown by `complete` when the model stopped at its output limit. Asking again with the same
 * prompt runs out again, so the check stops and says how to make it smaller.
 */
export class ReplyOutOfRoom extends Error {
  constructor() {
    super(
      'The model ran out of room before finishing the check. Cite the requirements this pull request implements (REQ- or CHG- IDs in its title, description or commits) so fewer are judged, or choose a model with a larger output limit in Settings.',
    );
    this.name = 'ReplyOutOfRoom';
  }
}

/** Twice without a usable reply; a reasoning model that runs out of room before answering looks like this. */
export const UNUSABLE_REPLY =
  'The model did not return a check result, twice. Try again, or choose a different model in Settings. A reasoning model can run out of room before it answers on a large pull request.';

export interface CheckInput {
  projectTitle: string;
  change: {
    source: CheckSource;
    /** Empty for a pasted diff, which has no title, description or commits to cite IDs in. */
    title: string;
    body: string;
    commitMessages: string[];
    files: DiffFile[];
    /** Limits the source put on what it returned. */
    notes: string[];
  };
  claims: readonly ScopeClaim[];
  changes: readonly ScopeChange[];
  model: { contextTokens: number; maxOutputTokens: number };
}

export interface CheckOutcome {
  source: CheckSource;
  verdicts: RequirementVerdict[];
  otherFindings: OtherFinding[];
  coverage: CheckCoverage;
  notes: string[];
  status: CheckStatus;
  overallScore: number;
}

/**
 * Checks a change against the project's requirements: scope from what it cites, a diff sized to the
 * model, one model call (retried once if the reply is not usable JSON), and a grade computed from
 * the parsed verdicts. Refuses a change with no files and a project with no live requirements.
 */
export async function runCheck(input: CheckInput, complete: (prompt: string) => Promise<string>): Promise<CheckOutcome> {
  const { change } = input;
  if (change.files.length === 0) throw new Error('This change has no changed files to check.');
  const live = input.claims.filter((claim) => !claim.retired);
  if (live.length === 0) {
    throw new Error('This project has no requirements to check against yet. Generate its documents first.');
  }

  const scope = resolveScope([change.title, change.body, ...change.commitMessages], input.claims, input.changes);
  const candidates = scope.requirements.length ? [] : live;
  const pullRequest = change.source.kind === 'pasted' ? undefined : { title: change.title, body: change.body, commitMessages: change.commitMessages };
  const promptFor = (reviewed: DiffFile[], skipped: CheckCoverage['skippedFiles']) =>
    buildCheckPrompt({ projectTitle: input.projectTitle, pullRequest, scope: scope.requirements, candidates, reviewed, skipped });

  // The skipped list is not known yet, so it is measured at its largest: every file skipped.
  const everySkipped = change.files.map((file) => ({ path: file.path, reason: '' }));
  const budget = diffBudgetFor(input.model, promptFor([], everySkipped).length);
  const { reviewed, skipped } = budgetDiff(change.files, budget);
  const coverage: CheckCoverage = { reviewedFiles: reviewed.map((file) => file.path), skippedFiles: skipped };
  const notes = [...change.notes, ...scope.notes];

  let verdicts: RequirementVerdict[];
  let otherFindings: OtherFinding[] = [];
  if (reviewed.length === 0) {
    notes.push('No file in this change could be read, so nothing was judged.');
    verdicts = scope.requirements.map((requirement) => ({
      claimId: requirement.claimId,
      scope: requirement.scope,
      verdict: 'not_shown',
      severity: null,
      explanation: 'No file in this change could be read.',
      evidence: [],
    }));
  } else {
    const prompt = promptFor(reviewed, skipped);
    const context = { scope: scope.requirements, candidates, reviewed };
    let parsed;
    try {
      parsed = parseCheck(await complete(prompt), context);
    } catch (error) {
      if (error instanceof ReplyOutOfRoom) throw error;
      try {
        parsed = parseCheck(await complete(`${prompt}\n\nYour last reply was not the JSON object asked for. Reply with only that object.`), context);
      } catch {
        throw new Error(UNUSABLE_REPLY);
      }
    }
    verdicts = parsed.verdicts;
    otherFindings = parsed.otherFindings;
    notes.push(...parsed.notes);
  }

  return {
    source: change.source,
    verdicts: sortVerdicts(verdicts),
    otherFindings,
    coverage,
    notes,
    status: checkStatus(verdicts, coverage),
    overallScore: checkScore(verdicts),
  };
}
