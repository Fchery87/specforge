import { describe, expect, it } from 'vitest';
import { renderChangeMarkdown } from '../render-markdown';

describe('renderChangeMarkdown', () => {
  it('writes the change, its bug report and every edit under its requirement ID', () => {
    const markdown = renderChangeMarkdown({
      changeNumber: 3,
      kind: 'bugfix',
      title: 'Invite links show a 404',
      summary: 'Opening an invite link shows a 404.',
      bug: { observed: 'A 404 page.', expected: 'The invite page.', reproduction: 'Open an invite link.' },
      appliedAt: Date.UTC(2026, 8, 27),
      ops: [
        { reason: 'Catches the 404.', claimId: 'REQ-0015', phaseId: 'stories', op: { type: 'add', phaseId: 'stories', kind: 'acceptance_criterion', text: 'Given an invite link, when it is opened, then the invite page loads.' } },
        { reason: 'Links too.', claimId: 'REQ-0012', phaseId: 'prd', op: { type: 'modify', claim: 'c12', baseText: 'Owners invite by email.', text: 'Owners invite by email or link.' } },
        { reason: 'Links carry their own expiry.', claimId: 'REQ-0020', phaseId: 'specs', op: { type: 'remove', claim: 'c20', baseText: 'Invites expire after a day.' } },
        { reason: 'The spec is right.', claimId: 'REQ-0021', phaseId: 'prd', op: { type: 'reaffirm', claim: 'c21', baseText: 'Opening an invitation shows the invite page.' } },
      ],
    });

    expect(markdown).toBe(`# CHG-0003: Invite links show a 404

Bug fix, applied 2026-09-27.

Opening an invite link shows a 404.

## Bug report

- What happens: A 404 page.
- What should happen: The invite page.
- Steps to reproduce: Open an invite link.

## Edits to the requirements

### Added REQ-0015 (Tasks)

Given an invite link, when it is opened, then the invite page loads.

Why: Catches the 404.

### Reworded REQ-0012 (PRD)

Before: Owners invite by email.

After: Owners invite by email or link.

Why: Links too.

### Removed REQ-0020 (Architecture)

Was: Invites expire after a day.

Why: Links carry their own expiry.

### Reaffirmed REQ-0021 (PRD)

Opening an invitation shows the invite page.

The requirement stands; the implementation must meet it.

Why: The spec is right.
`);
  });
});
