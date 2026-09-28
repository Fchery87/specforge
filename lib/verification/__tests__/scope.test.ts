import { describe, expect, it } from 'vitest';
import { readCitations, resolveScope, type ScopeChange, type ScopeClaim } from '../scope';

const claims: ScopeClaim[] = [
  { claimId: 'REQ-0003', text: 'An invitation is valid for fourteen days after it is issued.', decisionStatus: 'confirmed', retired: false },
  { claimId: 'REQ-0004', text: 'An invitation accepted after it expires adds no member.', decisionStatus: 'proposed', retired: false },
  { claimId: 'REQ-0007', text: 'Entries are never edited in place.', decisionStatus: 'confirmed', retired: false },
  { claimId: 'REQ-0009', text: 'An invitation expires after one day.', decisionStatus: 'confirmed', retired: true },
];

const changes: ScopeChange[] = [
  { changeId: 'CHG-0002', status: 'applied', claimIds: ['REQ-0003', 'REQ-0004', 'REQ-0009'] },
  { changeId: 'CHG-0003', status: 'draft', claimIds: [] },
];

describe('readCitations', () => {
  it('finds REQ and CHG IDs once each, in order of first mention', () => {
    expect(readCitations(['Fixes REQ-0004 (see CHG-0002)', 'feat: expiry\n\nREQ-0004, REQ-0003', 'PREQ-0001 and REQ-12'])).toEqual([
      'REQ-0004',
      'CHG-0002',
      'REQ-0003',
    ]);
  });
});

describe('resolveScope', () => {
  it('brings in a cited requirement', () => {
    expect(resolveScope(['Implements REQ-0007'], claims, changes)).toEqual({
      requirements: [
        { claimId: 'REQ-0007', text: 'Entries are never edited in place.', decisionStatus: 'confirmed', scope: 'cited' },
      ],
      notes: [],
    });
  });

  it('expands an applied change to its live requirements, and a direct citation wins over the change', () => {
    const scope = resolveScope(['Implements CHG-0002', 'Also REQ-0004'], claims, changes);
    expect(scope.requirements).toEqual([
      { claimId: 'REQ-0004', text: 'An invitation accepted after it expires adds no member.', decisionStatus: 'proposed', scope: 'cited' },
      { claimId: 'REQ-0003', text: 'An invitation is valid for fourteen days after it is issued.', decisionStatus: 'confirmed', scope: 'change', via: 'CHG-0002' },
    ]);
    expect(scope.notes).toEqual([]);
  });

  it('says why a citation brought nothing in', () => {
    expect(resolveScope(['REQ-0099 REQ-0009 CHG-0003 CHG-0042'], claims, changes)).toEqual({
      requirements: [],
      notes: [
        'REQ-0099 is cited but is not a requirement of this project.',
        'REQ-0009 is cited but was retired, so it was not checked.',
        'CHG-0003 is cited but is still a draft, so its requirements were not checked.',
        'CHG-0042 is cited but is not a change in this project.',
      ],
    });
  });

  it('is empty when nothing is cited, so the check infers its scope', () => {
    expect(resolveScope(['Tidy the invitation code'], claims, changes)).toEqual({ requirements: [], notes: [] });
  });
});
