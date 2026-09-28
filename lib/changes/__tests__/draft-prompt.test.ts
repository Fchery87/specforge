import { describe, expect, it } from 'vitest';
import { buildDraftChangePrompt } from '../draft-prompt';

const base = {
  title: 'Invite links',
  summary: 'Let owners share a link instead of typing emails.',
  claims: [
    { ref: 'c12', claimId: 'REQ-0012', phaseId: 'prd', text: 'Owners invite members by email.' },
    { ref: 'c30', claimId: 'REQ-0030', phaseId: 'stories', text: 'Given an owner, when they invite, then an email is sent.' },
  ],
  phasesWithDocuments: ['prd', 'stories'],
  evidence: [{ id: 'src-1', locator: 'lib/invites.ts', excerpt: 'export function sendInvite' }],
};

describe('buildDraftChangePrompt', () => {
  it('lists every requirement under its phase and ID, with the request and the files', () => {
    const prompt = buildDraftChangePrompt({ ...base, kind: 'feature' });

    expect(prompt).toContain('PRD (phase "prd"):\n- REQ-0012: Owners invite members by email.');
    expect(prompt).toContain('Tasks (phase "stories"):\n- REQ-0030: Given an owner, when they invite, then an email is sent.');
    expect(prompt).toContain('Change: Invite links\nLet owners share a link instead of typing emails.');
    expect(prompt).toContain('- [src-1] lib/invites.ts: export function sendInvite');
    expect(prompt).toContain('Add only to these phases: "prd", "stories".');
    expect(prompt).toContain('Only use requirement IDs listed above. Never invent one.');
    expect(prompt).not.toContain('This is a bug fix.');
  });

  it('gives a bug fix its report and the regression rule', () => {
    const prompt = buildDraftChangePrompt({
      ...base,
      kind: 'bugfix',
      title: 'Invite link 404s',
      bug: { observed: 'A 404 page.', expected: 'The invite page.', reproduction: 'Open an invite link.' },
    });

    expect(prompt).toContain('Bug: Invite link 404s');
    expect(prompt).toContain('Observed: A 404 page.\nExpected: The invite page.\nSteps to reproduce: Open an invite link.');
    expect(prompt).toContain('Always "add" at least one acceptance criterion to the "stories" phase');
  });

  it('says so when no repository is connected', () => {
    expect(buildDraftChangePrompt({ ...base, kind: 'feature', evidence: [] })).toContain('No repository files are connected.');
  });
});
