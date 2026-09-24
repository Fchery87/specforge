const DEFAULT_EXCERPT_LIMIT = 500;

export interface ClaimCandidate {
  text: string;
  kind: 'decision' | 'requirement' | 'acceptance_criterion';
  sourceIds?: string[];
}

export interface ClaimManifestItem {
  claimId: string;
  text: string;
  decisionStatus: string;
  reviewStatus: string;
  links: Array<{
    supportStatus: string;
    source: { locator: string; revisionLabel: string } | null;
  }>;
}

export function formatClaimManifest(claims: ClaimManifestItem[]): string {
  if (!claims.length) return '';
  const lines = [
    '',
    '## Requirement Traceability',
    '',
    'Review status and evidence links are advisory project records.',
    ...claims.map((claim) => {
      const sources = claim.links
        .map((link) => `${link.source?.locator ?? 'missing source'} (${link.source?.revisionLabel ?? 'unknown revision'}, ${link.supportStatus})`)
        .join('; ');
      return `- **${claim.claimId}** [${claim.decisionStatus}; ${claim.reviewStatus}]: ${claim.text}${sources ? ` — Evidence: ${sources}` : ' — Evidence not captured'}`;
    }),
  ];
  return `${lines.join('\n')}\n`;
}

export function extractClaimCandidates(
  content: string,
  phaseId: string,
  allowedSourceIds: Set<string> = new Set(),
): ClaimCandidate[] {
  const kind: ClaimCandidate['kind'] =
    phaseId === 'constitution'
      ? 'decision'
      : phaseId === 'stories'
        ? 'acceptance_criterion'
        : 'requirement';
  const claims: ClaimCandidate[] = [];
  let inCode = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const rawItem = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/)?.[1]?.trim();
    if (!rawItem) continue;
    const sourceMatches = [...rawItem.matchAll(/<!--\s*evidence-source:\s*([A-Za-z0-9_-]+)\s*-->/g)];
    const item = rawItem.replace(/\s*<!--\s*evidence-source:\s*[A-Za-z0-9_-]+\s*-->/g, '').trim();
    if (item.length < 18 || item.length > 4_000) continue;
    if (!/\b(must|shall|required|requirement|acceptance|should|will|decision|constraint|given|when|then)\b/i.test(item)) continue;
    if (claims.some((claim) => claim.text.toLowerCase() === item.toLowerCase())) continue;
    claims.push({
      text: item,
      kind,
      ...(sourceMatches.length
        ? { sourceIds: [...new Set(sourceMatches.map((match) => match[1]).filter((id) => allowedSourceIds.has(id)))] }
        : {}),
    });
    if (claims.length >= 100) break;
  }
  return claims;
}

/** Returns a content digest suitable for comparing immutable evidence revisions. */
export async function createEvidenceDigest(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/** Creates a bounded display excerpt and removes common credential formats. */
export function createEvidenceExcerpt(
  content: string,
  maxLength = DEFAULT_EXCERPT_LIMIT,
): string {
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error('Excerpt length must be a positive integer');
  }

  const redacted = content
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1: [REDACTED]');

  return redacted.slice(0, maxLength).trimEnd();
}

/** Normalizes and validates a Git repository path before storing it as evidence. */
export function normalizeRepositoryPath(path: string): string {
  const normalizedSeparators = path.replace(/\\/g, '/');
  if (normalizedSeparators.startsWith('/') || /^[A-Za-z]:\//.test(normalizedSeparators)) {
    throw new Error('Repository path must be relative');
  }
  if (normalizedSeparators.includes('\0')) {
    throw new Error('Repository path contains an invalid character');
  }

  const parts: string[] = [];
  for (const part of normalizedSeparators.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) {
        throw new Error('Repository path escapes the scanned repository');
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  if (parts.length === 0) throw new Error('Repository path must not be empty');
  return parts.join('/');
}
