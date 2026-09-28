/** One file of a diff, whole. `patch` is the unified hunks; GitHub omits it for binary files. */
export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

/** A line of a patch without its `+`, `-` or space marker. `line` is the new file's line number. */
export interface PatchLine {
  text: string;
  kind: 'added' | 'removed' | 'context';
  line?: number;
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Splits `git diff` output into files, keeping every hunk. */
export function splitUnifiedDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  for (const block of text.split(/^diff --git /m).slice(1)) {
    const lines = block.split(/\r?\n/);
    const header = lines[0].match(/^a\/(.+?) b\/(.+)$/);
    if (!header) continue;
    const path = header[2];
    const hunkStart = lines.findIndex((line) => line.startsWith('@@'));
    const hunks = hunkStart === -1 ? [] : lines.slice(hunkStart);
    const meta = hunkStart === -1 ? lines : lines.slice(0, hunkStart);
    const status: DiffFile['status'] = meta.some((line) => line.startsWith('new file mode'))
      ? 'added'
      : meta.some((line) => line.startsWith('deleted file mode'))
        ? 'deleted'
        : meta.some((line) => line.startsWith('rename to'))
          ? 'renamed'
          : 'modified';
    while (hunks.length && hunks[hunks.length - 1] === '') hunks.pop();
    files.push({
      path,
      status,
      additions: hunks.filter((line) => line.startsWith('+')).length,
      deletions: hunks.filter((line) => line.startsWith('-')).length,
      ...(hunks.length ? { patch: hunks.join('\n') } : {}),
    });
  }
  return files;
}

/** The lines of a patch with the new file's line numbers, for checking and linking quotes. */
export function readPatch(patch: string): PatchLine[] {
  const lines: PatchLine[] = [];
  let next: number | undefined;
  for (const raw of patch.split(/\r?\n/)) {
    const hunk = raw.match(HUNK_HEADER);
    if (hunk) {
      next = Number(hunk[1]);
      continue;
    }
    if (next === undefined || raw.startsWith('\\')) continue;
    if (raw.startsWith('-')) {
      lines.push({ text: raw.slice(1), kind: 'removed' });
    } else {
      lines.push({ text: raw.slice(1), kind: raw.startsWith('+') ? 'added' : 'context', line: next });
      next += 1;
    }
  }
  return lines;
}
