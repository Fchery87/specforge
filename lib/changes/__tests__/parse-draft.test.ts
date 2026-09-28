import { describe, expect, it } from 'vitest';
import { parseDraft, type DraftContext } from '../parse-draft';

const context: DraftContext = {
  kind: 'feature',
  claims: [
    { ref: 'c12', claimId: 'REQ-0012', phaseId: 'prd', text: 'Owners invite members by email.' },
    { ref: 'c20', claimId: 'REQ-0020', phaseId: 'specs', text: 'Invites expire after a day.' },
  ],
  phasesWithDocuments: ['prd', 'specs', 'stories'],
  evidenceSourceIds: ['src-1'],
};

const reply = (operations: unknown[]) => `Here is the draft:\n\`\`\`json\n${JSON.stringify({ operations })}\n\`\`\``;

describe('parseDraft', () => {
  it('turns drafted edits into operations with the registry wording as their base', () => {
    const result = parseDraft(
      reply([
        { type: 'add', phase: 'prd', kind: 'requirement', text: ' Owners may share an invite link. ', reason: 'Asked for links.', evidence: ['src-1', 'invented'] },
        { type: 'modify', claimId: 'REQ-0012', text: 'Owners invite members by email or link.', reason: 'Links too.' },
        { type: 'remove', claimId: 'REQ-0020', reason: 'Invites no longer expire.' },
      ]),
      context,
    );

    expect(result).toEqual({
      ops: [
        { reason: 'Asked for links.', evidenceSourceIds: ['src-1'], op: { type: 'add', phaseId: 'prd', kind: 'requirement', text: 'Owners may share an invite link.' } },
        { reason: 'Links too.', evidenceSourceIds: [], op: { type: 'modify', claim: 'c12', baseText: 'Owners invite members by email.', text: 'Owners invite members by email or link.' } },
        { reason: 'Invites no longer expire.', evidenceSourceIds: [], op: { type: 'remove', claim: 'c20', baseText: 'Invites expire after a day.' } },
      ],
      notes: [],
      missingRegression: false,
    });
  });

  it('drops what it cannot trust and says why', () => {
    const result = parseDraft(
      reply([
        { type: 'modify', claimId: 'REQ-0999', text: 'Anything.', reason: 'Invented.' },
        { type: 'add', phase: 'artifacts', text: 'A schema rule that must hold.' },
        { type: 'modify', claimId: 'REQ-0012', text: 'Owners invite members by email.' },
        { type: 'reaffirm', claimId: 'REQ-0020' },
        { type: 'remove', claimId: 'REQ-0020' },
        { type: 'rename', claimId: 'REQ-0012' },
      ]),
      context,
    );

    expect(result.ops).toEqual([
      { reason: 'No reason was drafted.', evidenceSourceIds: [], op: { type: 'reaffirm', claim: 'c20', baseText: 'Invites expire after a day.' } },
    ]);
    expect(result.notes).toEqual([
      'Drafted edit 1 targeted REQ-0999, which is not a current requirement, and was dropped.',
      'Drafted edit 2 added to "artifacts", which has no document, and was dropped.',
      'Drafted edit 3 did not change the wording of REQ-0012 and was dropped.',
      'Drafted edit 5 targeted REQ-0020 a second time and was dropped.',
      'Drafted edit 6 was not a recognisable edit and was dropped.',
    ]);
  });

  it('fills in the kind a phase implies when the draft omits it', () => {
    const { ops } = parseDraft(reply([{ type: 'add', phase: 'stories', text: 'Given a link, when opened, then the invite loads.' }]), context);

    expect(ops[0]?.op).toMatchObject({ type: 'add', kind: 'acceptance_criterion' });
  });

  it('flags a bug fix that adds no acceptance criterion', () => {
    const bugfix = { ...context, kind: 'bugfix' as const };

    expect(parseDraft(reply([{ type: 'reaffirm', claimId: 'REQ-0012', reason: 'Spec is right.' }]), bugfix).missingRegression).toBe(true);
    expect(
      parseDraft(
        reply([
          { type: 'reaffirm', claimId: 'REQ-0012', reason: 'Spec is right.' },
          { type: 'add', phase: 'stories', kind: 'acceptance_criterion', text: 'Given an invite, when emailed, then it arrives.' },
        ]),
        bugfix,
      ).missingRegression,
    ).toBe(false);
  });

  it('refuses a reply with no JSON or no operations list', () => {
    expect(() => parseDraft('I could not draft this.', context)).toThrow('The draft reply held no JSON object');
    expect(() => parseDraft('{"ops": []}', context)).toThrow('The draft reply had no "operations" list');
    expect(() => parseDraft('{ not json }', context)).toThrow('The draft reply was not valid JSON');
  });
});
