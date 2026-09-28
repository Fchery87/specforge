import type { SkippedFile } from './check';
import type { DiffFile } from './diff';

/** About 15,000 tokens of patch: room for the requirements and the reply in a mid-size context. */
export const DIFF_BUDGET_CHARS = 60_000;

const LOCKFILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'poetry.lock',
  'uv.lock',
  'go.sum',
]);
const GENERATED = [/(^|\/)_generated\//, /(^|\/)(dist|build|out|\.next|coverage)\//, /\.min\.(js|css)$/, /\.map$/, /\.snap$/];

export const SKIP_REASONS = {
  lockfile: 'Lockfile',
  generated: 'Generated file',
  binary: 'Binary file, or too large for GitHub to show',
  overBudget: 'Past the size this check reads',
} as const;

export interface BudgetedDiff {
  /** Whole files, in the diff's own order. */
  reviewed: Array<DiffFile & { patch: string }>;
  skipped: SkippedFile[];
}

function skipReason(file: DiffFile): string | null {
  const name = file.path.split('/').pop() ?? file.path;
  if (LOCKFILES.has(name)) return SKIP_REASONS.lockfile;
  if (GENERATED.some((pattern) => pattern.test(file.path))) return SKIP_REASONS.generated;
  if (!file.patch) return SKIP_REASONS.binary;
  return null;
}

/**
 * The files the check reads. The largest changes go in first, because they usually carry the pull
 * request's substance; a file that does not fit is skipped whole and smaller ones still get a turn.
 * Nothing is cut partway, and everything left out is named with its reason.
 */
export function budgetDiff(files: readonly DiffFile[], budget = DIFF_BUDGET_CHARS): BudgetedDiff {
  const skipped: SkippedFile[] = [];
  const candidates: Array<DiffFile & { patch: string }> = [];
  for (const file of files) {
    const reason = skipReason(file);
    if (reason) skipped.push({ path: file.path, reason });
    else candidates.push(file as DiffFile & { patch: string });
  }

  const chosen = new Set<string>();
  let used = 0;
  const bySize = [...candidates].sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions));
  for (const file of bySize) {
    if (used + file.patch.length > budget) {
      skipped.push({ path: file.path, reason: SKIP_REASONS.overBudget });
      continue;
    }
    used += file.patch.length;
    chosen.add(file.path);
  }

  return { reviewed: candidates.filter((file) => chosen.has(file.path)), skipped };
}
