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
