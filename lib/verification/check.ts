/**
 * A pull-request check: what was read, which requirements it covered, and a verdict for each.
 *
 * The model reports what it saw; everything that decides the outcome (severity, status, score) is
 * computed here from the verdict and the requirement's decision status, so the same verdicts always
 * grade the same way.
 */

export type DecisionStatus = 'confirmed' | 'observed' | 'proposed' | 'unresolved';
export type Verdict = 'met' | 'violated' | 'incomplete' | 'not_shown';
export type Severity = 'critical' | 'major' | 'minor';
export type CheckStatus = 'pass' | 'warning' | 'fail';

/** How a requirement came into the check: cited by ID, through a cited change, or chosen by the model. */
export type ScopeReason = 'cited' | 'change' | 'inferred';

export type CheckSource =
  | { kind: 'pull_request'; number: number; title: string; url: string; baseSha: string; headSha: string }
  | { kind: 'range'; base: string; head: string; baseSha: string; headSha: string }
  | { kind: 'pasted' };

/** Lines from the reviewed diff, verified to be there. `line` is the new file's line number when known. */
export interface DiffQuote {
  path: string;
  line?: number;
  quote: string;
}

export interface RequirementVerdict {
  claimId: string;
  scope: ScopeReason;
  verdict: Verdict;
  severity: Severity | null;
  explanation: string;
  evidence: DiffQuote[];
}

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface CheckCoverage {
  reviewedFiles: string[];
  skippedFiles: SkippedFile[];
}

/** A problem the model noticed outside any requirement. Shown apart; never part of the grade. */
export interface OtherFinding {
  category: 'bug' | 'security' | 'performance';
  title: string;
  description: string;
  path?: string;
}

const SEVERITY: Record<Verdict, { confirmed: Severity | null; other: Severity | null }> = {
  violated: { confirmed: 'critical', other: 'major' },
  incomplete: { confirmed: 'major', other: 'minor' },
  met: { confirmed: null, other: null },
  not_shown: { confirmed: null, other: null },
};

/** Breaking a confirmed requirement is worse than breaking one still proposed. */
export function severityFor(verdict: Verdict, decisionStatus: DecisionStatus): Severity | null {
  return SEVERITY[verdict][decisionStatus === 'confirmed' ? 'confirmed' : 'other'];
}

/** A skipped file lowers a pass to a warning: the check cannot vouch for code it did not read. */
export function checkStatus(verdicts: readonly RequirementVerdict[], coverage: CheckCoverage): CheckStatus {
  if (verdicts.some((verdict) => verdict.severity === 'critical')) return 'fail';
  if (verdicts.some((verdict) => verdict.severity === 'major') || coverage.skippedFiles.length > 0) return 'warning';
  return 'pass';
}

const SCORE_DEDUCTION: Record<Severity, number> = { critical: 25, major: 10, minor: 3 };

/** The dashboard's health score, from the verdicts' severities. */
export function checkScore(verdicts: readonly RequirementVerdict[]): number {
  const deduction = verdicts.reduce(
    (total, verdict) => total + (verdict.severity ? SCORE_DEDUCTION[verdict.severity] : 0),
    0,
  );
  return Math.max(0, 100 - deduction);
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };
const VERDICT_RANK: Record<Verdict, number> = { violated: 0, incomplete: 1, not_shown: 2, met: 3 };

/** Worst first: by severity, then by verdict, then by ID. */
export function sortVerdicts(verdicts: readonly RequirementVerdict[]): RequirementVerdict[] {
  return [...verdicts].sort(
    (a, b) =>
      (a.severity ? SEVERITY_RANK[a.severity] : 3) - (b.severity ? SEVERITY_RANK[b.severity] : 3) ||
      VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] ||
      a.claimId.localeCompare(b.claimId),
  );
}
