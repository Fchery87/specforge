import { describe, expect, it } from 'vitest';
import {
  createEvidenceDigest,
  createEvidenceExcerpt,
  extractClaimCandidates,
  normalizeRepositoryPath,
} from '../evidence';

describe('evidence source helpers', () => {
  it('extracts reviewable claim candidates outside code blocks with phase-specific types', () => {
    const markdown = `## Acceptance Criteria\n- The service must reject expired sessions.\n\n\`\`\`ts\n- This should not become a requirement.\n\`\`\``;
    expect(extractClaimCandidates(markdown, 'stories')).toEqual([
      { text: 'The service must reject expired sessions.', kind: 'acceptance_criterion' },
    ]);
    expect(extractClaimCandidates('- The architecture decision will use event sourcing.', 'constitution')[0]?.kind).toBe('decision');
  });

  it('reads the ID an item was written under and strips the manifest wrapping', () => {
    const markdown = [
      '- **REQ-0012** A team owner invites members by email address.',
      '- **REQ-0013** [confirmed; reviewed]: Entries are never edited in place. — Evidence: lib/ledger.ts (4f2a91c, supports)',
      '- **REQ-0014** [proposed; needs_review]: Exports reconcile to the cent. — Evidence not captured',
    ].join('\n');

    expect(extractClaimCandidates(markdown, 'prd')).toEqual([
      { text: 'A team owner invites members by email address.', kind: 'requirement', claimId: 'REQ-0012' },
      { text: 'Entries are never edited in place.', kind: 'requirement', claimId: 'REQ-0013' },
      { text: 'Exports reconcile to the cent.', kind: 'requirement', claimId: 'REQ-0014' },
    ]);
  });

  it('reads a labelled document by its marks and skips the annotations around them', () => {
    const markdown = [
      '- **REQ-0036** **Requirement:** An entry created by a team owner carries that owner as its author.',
      '  - **Priority:** Must · **Status:** Proposed (inference)',
      '  - **Trace:** *Inference* — the project description states that "Every entry records who made it".',
      '- **Requirement (new):** An invitation carries the moment at which it was issued.',
      '- **(Must)** **Requirement:** An invitation is accepted at most once.',
      '- **Scenario:** Given an invitation issued two days ago, when the invitee accepts it, then they join the team.',
      '- **REQ-0024** measures the invitation lifetime as seven days and is marked Confirmed.',
      '- **REQ-0023** **Priority:** Must · **Status:** Confirmed (rule)',
      '- **Team owner.** Issues invitations for the team and must approve each one.',
      '- **Target** — the value that counts as success, which the report must name.',
      '- No requirement states whether a non-member can read a ledger, so when it is settled it will be added.',
    ].join('\n');

    expect(extractClaimCandidates(markdown, 'prd')).toEqual([
      { text: 'An entry created by a team owner carries that owner as its author.', kind: 'requirement', claimId: 'REQ-0036' },
      { text: 'An invitation carries the moment at which it was issued.', kind: 'requirement' },
      { text: 'An invitation is accepted at most once.', kind: 'requirement' },
      {
        text: 'Given an invitation issued two days ago, when the invitee accepts it, then they join the team.',
        kind: 'requirement',
      },
    ]);
  });

  it('falls back to obligation wording in a document that marks nothing, without counting talk about requirements', () => {
    const markdown = [
      '- A team owner must be able to revoke an invitation.',
      '- Each requirement states one obligation.',
      '- **Priority:** Must · **Status:** Confirmed',
      '- **Invited person.** Identified solely by the email address the invitation must name.',
    ].join('\n');

    expect(extractClaimCandidates(markdown, 'prd')).toEqual([
      { text: 'A team owner must be able to revoke an invitation.', kind: 'requirement' },
    ]);
  });

  it('accepts only evidence markers from the captured source allowlist', () => {
    const claims = extractClaimCandidates(
      '- The service must deny access to expired sessions. <!-- evidence-source: src-1 -->\n' +
        '- The service should log every denied attempt. <!-- evidence-source: invented -->',
      'prd',
      new Set(['src-1']),
    );
    expect(claims).toEqual([
      {
        text: 'The service must deny access to expired sessions.',
        kind: 'requirement',
        sourceIds: ['src-1'],
      },
      {
        text: 'The service should log every denied attempt.',
        kind: 'requirement',
        sourceIds: [],
      },
    ]);
  });

  it('creates a stable SHA-256 digest for captured source content', async () => {
    await expect(createEvidenceDigest('SpecForge')).resolves.toBe(
      '0cc1e2befd7900fb3635e9d00b9952737f8b0483f03032928d1c661243297129',
    );
  });

  it('bounds and redacts secret-like values from display excerpts', () => {
    const excerpt = createEvidenceExcerpt(
      'Token: ghp_123456789012345678901234567890123456\n' + 'x'.repeat(600),
      32,
    );
    expect(excerpt).toBe('Token: [REDACTED]\nxxxxxxxxxxxxxx');
    expect(excerpt.length).toBeLessThanOrEqual(32);
  });

  it('normalizes repository paths and rejects traversal paths', () => {
    expect(normalizeRepositoryPath('./src\\app.ts')).toBe('src/app.ts');
    expect(() => normalizeRepositoryPath('../secrets.env')).toThrow(
      'Repository path escapes the scanned repository',
    );
    expect(() => normalizeRepositoryPath('/etc/passwd')).toThrow(
      'Repository path must be relative',
    );
  });
});
