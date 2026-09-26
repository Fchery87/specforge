/**
 * Claim manifests.
 *
 * A generated specification carries a Requirement Traceability section whose bullets look like:
 *
 *   - **C-014** [confirmed; reviewed]: A member with the editor role may archive a project.
 *     — Evidence: lib/authz.ts (4f2a91c, supports); Who may archive (2026-09-22, supports)
 *
 * The reading surface turns that into a state per claim, and a state per section, so a gap is
 * visible while reading instead of hidden in a review panel.
 */

export type ClaimState = "confirmed" | "proposed" | "untraced";

export interface ClaimEvidence {
  locator: string;
  revision: string;
  support: string;
}

export interface ParsedClaim {
  claimId: string;
  decisionStatus: string;
  reviewStatus: string;
  text: string;
  evidence: ClaimEvidence[];
  hasEvidence: boolean;
}

const CLAIM_BULLET =
  /^[-*]\s+\*\*(?<claimId>[A-Za-z][A-Za-z0-9]*-\d+)\*\*\s*\[(?<decision>[^;\]]+);\s*(?<review>[^\]]+)\]\s*:\s*(?<rest>.+)$/;

/** `formatClaimManifest` writes `— Evidence: ...` and `— Evidence not captured`. The colon is
 * optional because the second form has none. */
const EVIDENCE_SPLIT = /\s+(?:—|–|-)\s+Evidence:?\s*/;
const NOT_CAPTURED = /^(?:not captured|none|n\/a)\.?$/i;

/** `lib/authz.ts (4f2a91c, supports)` becomes locator, revision, support. */
function parseEvidenceEntry(entry: string): ClaimEvidence {
  const trimmed = entry.trim();
  const match = /^(?<locator>.+?)\s*\((?<revision>[^,)]*)\s*,\s*(?<support>[^)]+)\)\s*$/.exec(trimmed);

  if (!match?.groups) {
    return { locator: trimmed, revision: "unknown revision", support: "recorded" };
  }

  return {
    locator: match.groups.locator.trim(),
    revision: match.groups.revision.trim() || "unknown revision",
    support: match.groups.support.trim(),
  };
}

function splitClaimLine(rest: string): { text: string; evidence: ClaimEvidence[]; hasEvidence: boolean } {
  const parts = rest.split(EVIDENCE_SPLIT);

  if (parts.length === 1) {
    return { text: rest.trim(), evidence: [], hasEvidence: false };
  }

  const text = parts[0].trim();
  const evidencePart = rest.slice(parts[0].length).replace(EVIDENCE_SPLIT, "").trim();

  if (NOT_CAPTURED.test(evidencePart)) {
    return { text, evidence: [], hasEvidence: false };
  }

  const evidence = evidencePart
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseEvidenceEntry);

  return { text, evidence, hasEvidence: evidence.length > 0 };
}

/** Reads every claim bullet out of a piece of markdown, in document order. */
export function parseClaimManifest(markdown: string): ParsedClaim[] {
  const claims: ParsedClaim[] = [];

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("-") && !line.startsWith("*")) continue;

    const match = CLAIM_BULLET.exec(line);
    if (!match?.groups) continue;

    const { text, evidence, hasEvidence } = splitClaimLine(match.groups.rest);

    claims.push({
      claimId: match.groups.claimId,
      decisionStatus: match.groups.decision.trim().toLowerCase(),
      reviewStatus: match.groups.review.trim().toLowerCase(),
      text,
      evidence,
      hasEvidence,
    });
  }

  return claims;
}

const SETTLED_DECISIONS = new Set(["confirmed", "accepted", "agreed", "decided"]);

/** A claim with no evidence is untraced. Evidence plus an unsettled decision is proposed. */
export function claimState(claim: ParsedClaim): ClaimState {
  if (!claim.hasEvidence) return "untraced";
  if (SETTLED_DECISIONS.has(claim.decisionStatus) && claim.reviewStatus !== "pending") {
    return "confirmed";
  }
  return "proposed";
}

export interface ClaimSummary {
  total: number;
  confirmed: number;
  proposed: number;
  untraced: number;
  state: ClaimState;
}

/** The state of a whole section is the worst state of any claim in it. */
export function summarizeClaims(claims: ParsedClaim[]): ClaimSummary {
  const summary: ClaimSummary = {
    total: claims.length,
    confirmed: 0,
    proposed: 0,
    untraced: 0,
    state: "confirmed",
  };

  for (const claim of claims) {
    summary[claimState(claim)] += 1;
  }

  if (summary.total === 0) {
    summary.state = "untraced";
  } else if (summary.untraced > 0) {
    summary.state = "untraced";
  } else if (summary.proposed > 0) {
    summary.state = "proposed";
  }

  return summary;
}
