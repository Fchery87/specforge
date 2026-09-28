const DEFAULT_EXCERPT_LIMIT = 500;

export interface ClaimCandidate {
  text: string;
  kind: 'decision' | 'requirement' | 'acceptance_criterion';
  sourceIds?: string[];
  /** The ID the item was written under, such as `REQ-0012`. Unverified: reconciliation trusts it
   * only when it names a live claim of the same project and phase. */
  claimId?: string;
}

/** `**REQ-0012**`, optionally followed by the manifest's `[confirmed; reviewed]:`. */
const CLAIM_ID_PREFIX = /^\*\*(?<claimId>[A-Z][A-Z0-9]*-\d+)\*\*\s*(?:\[[^\]]*\])?\s*:?\s*/;
/** The manifest's ` — Evidence: ...` or ` — Evidence not captured` tail. */
const MANIFEST_EVIDENCE_TAIL = /\s+[—–]\s+Evidence(?::.*|\s+not captured\.?)$/;
/** A bold or italic lead-in, such as `**Priority:**`, `**Team owner.**` or `*Count of entries.*`. */
const LEAD_LABEL = /^(?<mark>\*\*|\*|_)(?<label>[^*_]+?)\k<mark>(?<after>\s*[:.—–]?)\s*/;
/** A lead-in that names the statement after it, which is kept without the label. */
const STATEMENT_LABEL = /^(?:requirement|acceptance criterion|scenario|decision|constraint)(?:\s*\([^)]*\))?$/i;
/** A priority or status tag in front of a statement, such as `**(Must)**`. */
const TAG_LABEL = /^\([^)]*\)$/;
/** Lead-ins that annotate a requirement rather than state one, even without a colon. */
const METADATA_LABEL = /^(?:priority|status|trace|source|verification|measures?|note|rationale|instrument|target|owner|evidence)\b/i;
/** Wording that marks an obligation in a document that labels none of its requirements.
 * "Requirement" and "acceptance" are left out: in a generated document they mostly describe the
 * document itself ("No requirement states..."). */
const OBLIGATION_WORDING = /\b(must|shall|required|should|will|decision|constraint|given|when|then)\b/i;

interface ParsedItem {
  text: string;
  claimId?: string;
  /** Opened with an ID or a statement label, the format the section prompt asks requirements in. */
  marked: boolean;
}

/**
 * Reads one list item as a claim, or returns null for an item that annotates or cites rather than
 * states. A generated requirement usually sits among bullets like `**Priority:** Must` and
 * `**Trace:** Project description`; taking those as claims gives them IDs, the next prompt lists
 * them as requirements, and the noise grows with every regeneration.
 */
function parseItem(item: string): ParsedItem | null {
  const claimId = item.match(CLAIM_ID_PREFIX)?.groups?.claimId;
  let text = claimId ? item.replace(CLAIM_ID_PREFIX, '').replace(MANIFEST_EVIDENCE_TAIL, '').trim() : item;
  // "**REQ-0024** measures the lifetime..." cites the requirement as the subject of a sentence.
  if (claimId && !/^[*_]*[A-Z0-9(]/.test(text)) return null;

  let marked = Boolean(claimId);
  for (let lead = text.match(LEAD_LABEL); lead?.groups; lead = text.match(LEAD_LABEL)) {
    const label = lead.groups.label.trim().replace(/[:.]$/, '').trim();
    const terminated = /[:.]$/.test(lead.groups.label.trim()) || lead.groups.after.trim() !== '';
    if (TAG_LABEL.test(label)) {
      text = text.slice(lead[0].length);
      continue;
    }
    if (STATEMENT_LABEL.test(label)) {
      text = text.slice(lead[0].length);
      marked = true;
      break;
    }
    if (terminated || METADATA_LABEL.test(label)) return null;
    break;
  }
  return { text: text.trim(), marked, ...(claimId ? { claimId } : {}) };
}

/** Every list item outside code fences, with the evidence markers it carries. */
function listItems(content: string): Array<{ item: ParsedItem; sourceIds: string[] | undefined }> {
  const items: Array<{ item: ParsedItem; sourceIds: string[] | undefined }> = [];
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
    const item = parseItem(rawItem.replace(/\s*<!--\s*evidence-source:\s*[A-Za-z0-9_-]+\s*-->/g, '').trim());
    if (item) items.push({ item, sourceIds: sourceMatches.length ? sourceMatches.map((match) => match[1]) : undefined });
  }
  return items;
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

/**
 * The claims a generated document states. A document that marks any requirement (by ID or by a
 * label such as `**Requirement:**`) is read by its marks alone, since the section prompt asks for
 * them; one that marks none, such as a document written before the prompt asked, falls back to
 * obligation wording.
 */
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
  const items = listItems(content);
  const readMarks = items.some(({ item }) => item.marked);
  const claims: ClaimCandidate[] = [];
  for (const { item, sourceIds } of items) {
    if (readMarks ? !item.marked : !OBLIGATION_WORDING.test(item.text)) continue;
    const { text, claimId } = item;
    if (text.length < 18 || text.length > 4_000) continue;
    if (claims.some((claim) => (claimId && claim.claimId === claimId) || claim.text.toLowerCase() === text.toLowerCase())) continue;
    claims.push({
      text,
      kind,
      ...(claimId ? { claimId } : {}),
      ...(sourceIds ? { sourceIds: [...new Set(sourceIds.filter((id) => allowedSourceIds.has(id)))] } : {}),
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
