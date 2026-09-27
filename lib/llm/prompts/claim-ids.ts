export interface LiveClaim {
  claimId: string;
  text: string;
}

/** Enough to cover a large PRD without letting the list crowd out the section being written. */
const MAX_CLAIMS = 150;
const MAX_CLAIM_CHARS = 300;

/**
 * The phase's current requirements with their IDs, and the rule for keeping them.
 *
 * Reconciliation matches a generated item to an existing claim by the `**REQ-0012**` it opens
 * with, before falling back to exact wording. Without this block the model never writes the ID,
 * so rewording a requirement retires it and issues a new one, and the old ID's evidence, review
 * and verification history stay behind on the retired row.
 */
export function formatLiveClaimsForPrompt(claims: readonly LiveClaim[] | undefined): string | null {
  if (!claims?.length) return null;

  const listed = claims.slice(0, MAX_CLAIMS).map((claim) => {
    const text = claim.text.length > MAX_CLAIM_CHARS ? `${claim.text.slice(0, MAX_CLAIM_CHARS)}…` : claim.text;
    return `- **${claim.claimId}** ${text}`;
  });
  const omitted = claims.length - listed.length;

  return [
    'Existing requirements in this document, with their IDs:',
    ...listed,
    ...(omitted > 0 ? [`(${omitted} more not listed)`] : []),
    '',
    'When a bullet you write states or rewords one of these requirements, begin it with that ID in bold, exactly as listed, for example "- **REQ-0012** ...". Keep the ID even if you change the wording. Write a new requirement without an ID. Never invent an ID or reuse one for a different requirement.',
  ].join('\n');
}
