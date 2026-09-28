import type { DecisionStatus, ScopeReason } from './check';

/** A requirement of the project, live or retired, as scope resolution needs it. */
export interface ScopeClaim {
  claimId: string;
  text: string;
  decisionStatus: DecisionStatus;
  retired: boolean;
}

/** A change and the requirement IDs it added, reworded or reaffirmed. */
export interface ScopeChange {
  changeId: string;
  status: 'draft' | 'applied' | 'abandoned';
  claimIds: string[];
}

export interface ScopedRequirement {
  claimId: string;
  text: string;
  decisionStatus: DecisionStatus;
  scope: Exclude<ScopeReason, 'inferred'>;
  /** The change that brought it in, for scope `change`. */
  via?: string;
}

export interface ResolvedScope {
  requirements: ScopedRequirement[];
  /** Citations that brought nothing in, in words the reader can act on. */
  notes: string[];
}

const CITATION = /\b(REQ|CHG)-\d{4,}\b/g;

/** Every `REQ-` and `CHG-` ID in the texts, first occurrence first. */
export function readCitations(texts: readonly string[]): string[] {
  return [...new Set(texts.flatMap((text) => text.match(CITATION) ?? []))];
}

/**
 * The requirements a pull request names, from the IDs its title, body and commit messages cite.
 * Only live requirements come in; a change counts only once applied, because until then its
 * requirements are not in the registry. An empty result means the check infers its scope.
 */
export function resolveScope(
  texts: readonly string[],
  claims: readonly ScopeClaim[],
  changes: readonly ScopeChange[],
): ResolvedScope {
  const claimsById = new Map(claims.map((claim) => [claim.claimId, claim]));
  const changesById = new Map(changes.map((change) => [change.changeId, change]));
  const requirements = new Map<string, ScopedRequirement>();
  const notes: string[] = [];
  const citations = readCitations(texts);

  const add = (claim: ScopeClaim, scope: ScopedRequirement['scope'], via?: string) => {
    if (requirements.get(claim.claimId)?.scope === 'cited') return;
    const { claimId, text, decisionStatus } = claim;
    requirements.set(claimId, { claimId, text, decisionStatus, scope, ...(via ? { via } : {}) });
  };

  for (const id of citations.filter((citation) => citation.startsWith('REQ-'))) {
    const claim = claimsById.get(id);
    if (!claim) notes.push(`${id} is cited but is not a requirement of this project.`);
    else if (claim.retired) notes.push(`${id} is cited but was retired, so it was not checked.`);
    else add(claim, 'cited');
  }
  for (const id of citations.filter((citation) => citation.startsWith('CHG-'))) {
    const change = changesById.get(id);
    if (!change) {
      notes.push(`${id} is cited but is not a change in this project.`);
      continue;
    }
    if (change.status !== 'applied') {
      notes.push(`${id} is cited but is ${change.status === 'draft' ? 'still a draft' : 'abandoned'}, so its requirements were not checked.`);
      continue;
    }
    for (const claim of change.claimIds.map((claimId) => claimsById.get(claimId))) {
      if (claim && !claim.retired) add(claim, 'change', id);
    }
  }

  return { requirements: [...requirements.values()], notes };
}
