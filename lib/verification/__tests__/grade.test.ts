import { describe, expect, it } from 'vitest';
import {
  checkScore,
  checkStatus,
  severityFor,
  sortVerdicts,
  type RequirementVerdict,
  type Severity,
  type Verdict,
} from '../check';

function verdict(claimId: string, value: Verdict, severity: Severity | null): RequirementVerdict {
  return { claimId, scope: 'cited', verdict: value, severity, explanation: '', evidence: [] };
}

const fullyRead = { reviewedFiles: ['convex/invitations.ts'], skippedFiles: [] };

describe('severityFor', () => {
  it('grades by the verdict and whether the requirement is confirmed', () => {
    expect(severityFor('violated', 'confirmed')).toBe('critical');
    expect(severityFor('violated', 'proposed')).toBe('major');
    expect(severityFor('violated', 'observed')).toBe('major');
    expect(severityFor('violated', 'unresolved')).toBe('major');
    expect(severityFor('incomplete', 'confirmed')).toBe('major');
    expect(severityFor('incomplete', 'proposed')).toBe('minor');
    expect(severityFor('met', 'confirmed')).toBeNull();
    expect(severityFor('not_shown', 'confirmed')).toBeNull();
  });
});

describe('checkStatus', () => {
  it('fails on any critical verdict', () => {
    expect(checkStatus([verdict('REQ-0001', 'met', null), verdict('REQ-0002', 'violated', 'critical')], fullyRead)).toBe('fail');
  });

  it('warns on a major verdict', () => {
    expect(checkStatus([verdict('REQ-0002', 'incomplete', 'major')], fullyRead)).toBe('warning');
  });

  it('warns when any file went unread, even with every requirement met', () => {
    const partlyRead = { reviewedFiles: ['convex/invitations.ts'], skippedFiles: [{ path: 'app/page.tsx', reason: 'Past the size this check reads' }] };
    expect(checkStatus([verdict('REQ-0001', 'met', null)], partlyRead)).toBe('warning');
  });

  it('passes when every verdict is met, minor or not shown and every file was read', () => {
    expect(
      checkStatus([verdict('REQ-0001', 'met', null), verdict('REQ-0002', 'incomplete', 'minor'), verdict('REQ-0003', 'not_shown', null)], fullyRead),
    ).toBe('pass');
  });
});

describe('checkScore', () => {
  it('deducts 25, 10 and 3 per critical, major and minor verdict, down to zero', () => {
    expect(checkScore([])).toBe(100);
    expect(checkScore([verdict('REQ-0001', 'violated', 'critical'), verdict('REQ-0002', 'incomplete', 'major'), verdict('REQ-0003', 'incomplete', 'minor')])).toBe(62);
    expect(checkScore(Array.from({ length: 5 }, (_, index) => verdict(`REQ-000${index}`, 'violated', 'critical')))).toBe(0);
  });
});

describe('sortVerdicts', () => {
  it('puts the worst first', () => {
    const sorted = sortVerdicts([
      verdict('REQ-0001', 'met', null),
      verdict('REQ-0005', 'incomplete', 'minor'),
      verdict('REQ-0003', 'not_shown', null),
      verdict('REQ-0004', 'violated', 'critical'),
      verdict('REQ-0002', 'violated', 'major'),
    ]);
    expect(sorted.map((item) => item.claimId)).toEqual(['REQ-0004', 'REQ-0002', 'REQ-0005', 'REQ-0003', 'REQ-0001']);
  });
});
