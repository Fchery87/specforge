import type { SkippedFile } from './check';
import type { DiffFile } from './diff';

/** About 15,000 tokens of patch, for a model whose context size is not known. */
export const DIFF_BUDGET_CHARS = 60_000;
/** Code tokenizes more densely than prose; three characters a token errs toward fitting. */
const CHARS_PER_TOKEN = 3;
/** The least room a reply gets: the verdicts and quotes themselves take a few thousand tokens. */
const MIN_REPLY_TOKENS = 8_000;

/**
 * Room for the reply: a quarter of the context, at least 8,000 tokens, and no more than the model
 * allows. Reasoning models spend this room thinking before they answer. With nothing cited, a
 * reasoning model weighed 48 requirements for about 30,000 tokens and ran out before writing a
 * verdict, at both 8,000 and 32,000 tokens of room.
 */
export function checkReplyTokens(model: { contextTokens: number; maxOutputTokens: number }): number {
  const share = Number.isFinite(model.contextTokens) && model.contextTokens > 0 ? Math.floor(model.contextTokens / 4) : MIN_REPLY_TOKENS;
  return Math.min(model.maxOutputTokens, Math.max(MIN_REPLY_TOKENS, share));
}
/** Headroom for file headers, fences and tokenizer differences between providers. */
const CONTEXT_HEADROOM = 0.9;

/**
 * How much diff a model can read in one check: its context, less the reply and the rest of the
 * prompt (instructions, pull request text and requirements). A model with a million-token context
 * reads a pull request of about 1.9 million characters whole; one whose size is unknown gets the
 * fixed fallback.
 */
export function diffBudgetFor(
  model: { contextTokens: number; maxOutputTokens: number },
  otherPromptChars: number,
): number {
  if (!Number.isFinite(model.contextTokens) || model.contextTokens <= 0) return DIFF_BUDGET_CHARS;
  const replyTokens = checkReplyTokens(model);
  const promptTokens = model.contextTokens * CONTEXT_HEADROOM - replyTokens;
  return Math.max(0, Math.floor(promptTokens * CHARS_PER_TOKEN) - otherPromptChars);
}

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
