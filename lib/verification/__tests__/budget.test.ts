import { describe, expect, it } from 'vitest';
import { budgetDiff, DIFF_BUDGET_CHARS, diffBudgetFor, SKIP_REASONS } from '../budget';
import { readPatch, splitUnifiedDiff, type DiffFile } from '../diff';

const pasted = [
  'diff --git a/convex/invitations.ts b/convex/invitations.ts',
  'index 1111111..2222222 100644',
  '--- a/convex/invitations.ts',
  '+++ b/convex/invitations.ts',
  '@@ -10,3 +10,4 @@ export function expiresAt(issuedAt: number) {',
  '   const day = 24 * 60 * 60 * 1000;',
  '-  return issuedAt + day;',
  '+  const lifetimeDays = 14;',
  '+  return issuedAt + lifetimeDays * day;',
  ' }',
  'diff --git a/lib/new.ts b/lib/new.ts',
  'new file mode 100644',
  'index 0000000..3333333',
  '--- /dev/null',
  '+++ b/lib/new.ts',
  '@@ -0,0 +1 @@',
  '+export const added = true;',
  'diff --git a/public/logo.png b/public/logo.png',
  'index 4444444..5555555 100644',
  'Binary files a/public/logo.png and b/public/logo.png differ',
  '',
].join('\n');

function file(path: string, size: number): DiffFile {
  return { path, status: 'modified', additions: size, deletions: 0, patch: `@@ -1 +1,${size} @@\n${'+x\n'.repeat(size).trimEnd()}` };
}

describe('splitUnifiedDiff', () => {
  it('keeps each file whole with its status and counts, and a binary file without a patch', () => {
    const files = splitUnifiedDiff(pasted);
    expect(files.map(({ path, status, additions, deletions }) => ({ path, status, additions, deletions }))).toEqual([
      { path: 'convex/invitations.ts', status: 'modified', additions: 2, deletions: 1 },
      { path: 'lib/new.ts', status: 'added', additions: 1, deletions: 0 },
      { path: 'public/logo.png', status: 'modified', additions: 0, deletions: 0 },
    ]);
    expect(files[0].patch).toBe(
      [
        '@@ -10,3 +10,4 @@ export function expiresAt(issuedAt: number) {',
        '   const day = 24 * 60 * 60 * 1000;',
        '-  return issuedAt + day;',
        '+  const lifetimeDays = 14;',
        '+  return issuedAt + lifetimeDays * day;',
        ' }',
      ].join('\n'),
    );
    expect(files[2].patch).toBeUndefined();
  });
});

describe('readPatch', () => {
  it('numbers added and context lines by the new file, and leaves removed lines unnumbered', () => {
    expect(readPatch(splitUnifiedDiff(pasted)[0].patch ?? '')).toEqual([
      { text: '  const day = 24 * 60 * 60 * 1000;', kind: 'context', line: 10 },
      { text: '  return issuedAt + day;', kind: 'removed' },
      { text: '  const lifetimeDays = 14;', kind: 'added', line: 11 },
      { text: '  return issuedAt + lifetimeDays * day;', kind: 'added', line: 12 },
      { text: '}', kind: 'context', line: 13 },
    ]);
  });
});

describe('budgetDiff', () => {
  it('skips lockfiles, generated files and binaries with their reasons', () => {
    const { reviewed, skipped } = budgetDiff([
      file('package-lock.json', 400),
      file('convex/_generated/api.d.ts', 50),
      file('app/.next/cache.js', 5),
      file('dist/index.min.js', 5),
      { path: 'public/logo.png', status: 'modified', additions: 0, deletions: 0 },
      file('convex/invitations.ts', 3),
    ]);
    expect(reviewed.map((item) => item.path)).toEqual(['convex/invitations.ts']);
    expect(skipped).toEqual([
      { path: 'package-lock.json', reason: SKIP_REASONS.lockfile },
      { path: 'convex/_generated/api.d.ts', reason: SKIP_REASONS.generated },
      { path: 'app/.next/cache.js', reason: SKIP_REASONS.generated },
      { path: 'dist/index.min.js', reason: SKIP_REASONS.generated },
      { path: 'public/logo.png', reason: SKIP_REASONS.binary },
    ]);
  });

  it('takes the largest changes first, skips a file that does not fit whole, and keeps the diff order', () => {
    const small = file('a/small.ts', 2);
    const large = file('b/large.ts', 30);
    const huge = file('c/huge.ts', 100);
    const budget = large.patch!.length + small.patch!.length;

    const { reviewed, skipped } = budgetDiff([small, huge, large], budget);

    expect(reviewed.map((item) => item.path)).toEqual(['a/small.ts', 'b/large.ts']);
    expect(reviewed.every((item, index) => item.patch === [small, large][index].patch)).toBe(true);
    expect(skipped).toEqual([{ path: 'c/huge.ts', reason: SKIP_REASONS.overBudget }]);
  });
});

describe('diffBudgetFor', () => {
  it('sizes the diff to the model: context less the reply and the rest of the prompt', () => {
    expect(diffBudgetFor({ contextTokens: 1_000_000, maxOutputTokens: 32_000 }, 20_000)).toBe(2_656_000);
    expect(diffBudgetFor({ contextTokens: 128_000, maxOutputTokens: 4_096 }, 20_000)).toBe(313_312);
  });

  it('falls back to the fixed budget when the context size is unknown, and never goes below zero', () => {
    expect(diffBudgetFor({ contextTokens: 0, maxOutputTokens: 4_096 }, 20_000)).toBe(DIFF_BUDGET_CHARS);
    expect(diffBudgetFor({ contextTokens: 8_000, maxOutputTokens: 8_000 }, 90_000)).toBe(0);
  });
});
