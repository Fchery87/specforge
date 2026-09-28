import { phaseLabel } from '../workflow';
import type { DraftOp } from './parse-draft';
import { CHANGE_KIND_WORDS, formatChangeId, type ChangeKind } from './format';

export interface ExportedChange {
  changeNumber: number;
  kind: ChangeKind;
  title: string;
  summary: string;
  bug?: { observed: string; expected: string; reproduction: string };
  appliedAt: number;
  ops: Array<{
    reason: string;
    op: DraftOp;
    /** The requirement the edit acted on, or for an addition, the one it created. */
    claimId: string | null;
    phaseId: string;
  }>;
}

const HEADING: Record<DraftOp['type'], string> = {
  add: 'Added',
  modify: 'Reworded',
  remove: 'Removed',
  reaffirm: 'Reaffirmed',
};

function renderOp({ reason, op, claimId, phaseId }: ExportedChange['ops'][number]): string {
  const id = claimId ?? 'unrecorded ID';
  const lines = [`### ${HEADING[op.type]} ${id} (${phaseLabel(phaseId)})`, ''];
  if (op.type === 'add') lines.push(op.text);
  if (op.type === 'modify') lines.push(`Before: ${op.baseText}`, '', `After: ${op.text}`);
  if (op.type === 'remove') lines.push(`Was: ${op.baseText}`);
  if (op.type === 'reaffirm') lines.push(`${op.baseText}`, '', 'The requirement stands; the implementation must meet it.');
  lines.push('', `Why: ${reason}`);
  return lines.join('\n');
}

/**
 * One applied change as a coding agent reads it: what changed and why, the bug when there is one,
 * and every edit under the requirement ID it touched. The full requirements are in
 * `handoff/requirements.md`; this file is the delta.
 */
export function renderChangeMarkdown(change: ExportedChange): string {
  const applied = new Date(change.appliedAt).toISOString().slice(0, 10);
  const sections = [
    `# ${formatChangeId(change.changeNumber)}: ${change.title}`,
    `${CHANGE_KIND_WORDS[change.kind]}, applied ${applied}.`,
    change.summary,
  ];
  if (change.bug) {
    sections.push(
      [
        '## Bug report',
        '',
        `- What happens: ${change.bug.observed}`,
        `- What should happen: ${change.bug.expected}`,
        `- Steps to reproduce: ${change.bug.reproduction}`,
      ].join('\n'),
    );
  }
  sections.push(['## Edits to the requirements', '', ...change.ops.map(renderOp).join('\n\n').split('\n')].join('\n'));
  return `${sections.join('\n\n')}\n`;
}
