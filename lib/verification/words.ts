import type { CheckSource, CheckStatus, DiffQuote, ScopeReason, Severity, Verdict } from './check';

/** How a check's outcome, verdicts and scope are named everywhere a reader sees them. */
export const CHECK_STATUS_WORDS: Record<CheckStatus, string> = { pass: 'Passed', warning: 'Warnings', fail: 'Failed' };

export const VERDICT_WORDS: Record<Verdict, string> = {
  violated: 'Violated',
  incomplete: 'Incomplete',
  not_shown: 'Not shown in this diff',
  met: 'Met',
};

export const SCOPE_WORDS: Record<ScopeReason, string> = {
  cited: 'Cited in the pull request',
  change: 'From a cited change',
  inferred: 'Picked by the check',
};

export const SEVERITY_WORDS: Record<Severity, string> = { critical: 'Critical', major: 'Major', minor: 'Minor' };

/** What was checked, in a line: `#12 Longer invitations`, `main...feature/invites`, or a pasted diff. */
export function sourceLabel(source: CheckSource | undefined, phaseLabel?: string): string {
  if (!source) return phaseLabel ? `Pasted diff, ${phaseLabel}` : 'Pasted diff';
  if (source.kind === 'pull_request') return `#${source.number} ${source.title}`;
  if (source.kind === 'range') return `${source.base}...${source.head}`;
  return 'Pasted diff';
}

/** `1 critical, 2 major`, or null when nothing was graded. */
export function severityCounts(counts: Record<Severity, number>): string | null {
  const parts = (['critical', 'major', 'minor'] as const)
    .filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${severity}`);
  return parts.length ? parts.join(', ') : null;
}

/** A link to the quoted lines on GitHub at the commit that was checked; null for a pasted diff. */
export function quoteUrl(repositoryUrl: string | null, source: CheckSource | undefined, quote: DiffQuote): string | null {
  if (!repositoryUrl || !source || source.kind === 'pasted') return null;
  const path = quote.path.split('/').map(encodeURIComponent).join('/');
  return `${repositoryUrl.replace(/\/$/, '')}/blob/${source.headSha}/${path}${quote.line ? `#L${quote.line}` : ''}`;
}
