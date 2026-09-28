import { describe, expect, it } from 'vitest';
import { formatLiveClaimsForPrompt } from '../claim-ids';

describe('formatLiveClaimsForPrompt', () => {
  it('says nothing when the phase has no live claims', () => {
    expect(formatLiveClaimsForPrompt(undefined)).toBeNull();
    expect(formatLiveClaimsForPrompt([])).toBeNull();
  });

  it('lists each claim under its ID and states the rule for keeping IDs', () => {
    const block = formatLiveClaimsForPrompt([
      { claimId: 'REQ-0012', text: 'A team owner invites members by email.' },
      { claimId: 'REQ-0013', text: 'Entries are never edited in place.' },
    ]);

    expect(block).toBe(
      [
        'Existing requirements in this document, with their IDs:',
        '- **REQ-0012** A team owner invites members by email.',
        '- **REQ-0013** Entries are never edited in place.',
        '',
        'These are the current, reviewed requirements. Where one differs from the project description or an earlier answer, the requirement wins: it records a decision made since, often through an applied change. Write it as it stands and do not report the difference as a conflict.',
        '',
        'When a bullet you write states or rewords one of these requirements, begin it with that ID in bold, exactly as listed, for example "- **REQ-0012** ...". Keep the ID even if you change the wording. Put an ID at the start of a bullet only on the bullet that states that requirement; when you refer to a requirement anywhere else, write its ID inside the sentence. Write a new requirement without an ID. Never invent an ID or reuse one for a different requirement.',
      ].join('\n')
    );
  });

  it('caps the list and says how many were left out', () => {
    const claims = Array.from({ length: 152 }, (_, index) => ({
      claimId: `REQ-${String(index + 1).padStart(4, '0')}`,
      text: 'The service must respond.',
    }));
    const block = formatLiveClaimsForPrompt(claims) ?? '';

    expect(block).toContain('- **REQ-0150** The service must respond.');
    expect(block).not.toContain('REQ-0151');
    expect(block).toContain('(2 more not listed)');
  });
});
