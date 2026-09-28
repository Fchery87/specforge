import { describe, expect, it, vi } from 'vitest';
import { runDraft } from '../run-draft';

const input = {
  kind: 'bugfix' as const,
  title: 'Invite link 404s',
  summary: 'Opening an invite link shows a 404.',
  bug: { observed: 'A 404 page.', expected: 'The invite page.', reproduction: 'Open an invite link.' },
  claims: [{ ref: 'c12', claimId: 'REQ-0012', phaseId: 'prd', text: 'Owners invite members by email or link.' }],
  phasesWithDocuments: ['prd', 'stories'],
  evidence: [],
};
const reaffirm = { type: 'reaffirm', claimId: 'REQ-0012', reason: 'The spec is right.' };
const criterion = {
  type: 'add', phase: 'stories', kind: 'acceptance_criterion',
  text: 'Given an invite link, when it is opened, then the invite page loads.', reason: 'Catches the 404.',
};
const reply = (operations: unknown[]) => JSON.stringify({ operations });

describe('runDraft', () => {
  it('drafts once when the first reply is complete', async () => {
    const complete = vi.fn().mockResolvedValue(reply([reaffirm, criterion]));

    const result = await runDraft(input, complete);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.ops.map((op) => op.op.type)).toEqual(['reaffirm', 'add']);
    expect(result.notes).toEqual([]);
  });

  it('drafts a bug fix again with a reminder when the first reply has no regression criterion', async () => {
    const complete = vi.fn().mockResolvedValueOnce(reply([reaffirm])).mockResolvedValueOnce(reply([reaffirm, criterion]));

    const result = await runDraft(input, complete);

    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1]?.[0]).toContain('Your previous draft added no acceptance criterion.');
    expect(result.ops.map((op) => op.op.type)).toEqual(['reaffirm', 'add']);
  });

  it('keeps the edits and tells the reader when the retry still has no regression criterion', async () => {
    const complete = vi.fn().mockResolvedValue(reply([reaffirm, { type: 'remove', claimId: 'REQ-0999' }]));

    const result = await runDraft(input, complete);

    expect(result.ops.map((op) => op.op.type)).toEqual(['reaffirm']);
    expect(result.notes).toEqual([
      'Drafted edit 2 targeted REQ-0999, which is not a current requirement, and was dropped.',
      'The draft has no regression criterion. Add an acceptance criterion before applying.',
    ]);
  });
});
