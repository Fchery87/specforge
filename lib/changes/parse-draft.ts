import { z } from 'zod';

export type ClaimKind = 'decision' | 'requirement' | 'acceptance_criterion';

/** A live requirement the draft may act on. `ref` is the claim's database ID. */
export interface BaselineClaim {
  ref: string;
  claimId: string;
  phaseId: string;
  text: string;
}

export type DraftOp =
  | { type: 'add'; phaseId: string; kind: ClaimKind; text: string }
  | { type: 'modify'; claim: string; baseText: string; text: string }
  | { type: 'remove'; claim: string; baseText: string }
  | { type: 'reaffirm'; claim: string; baseText: string };

export interface DraftOpInput {
  reason: string;
  evidenceSourceIds: string[];
  op: DraftOp;
}

export interface ParsedDraft {
  ops: DraftOpInput[];
  /** What was dropped or repaired, in words the reader can act on. */
  notes: string[];
  /** A bug fix whose draft adds no acceptance criterion, so it has no regression test yet. */
  missingRegression: boolean;
}

export interface DraftContext {
  kind: 'feature' | 'bugfix';
  claims: readonly BaselineClaim[];
  /** Phases that have a document, so an addition has somewhere to go. */
  phasesWithDocuments: readonly string[];
  evidenceSourceIds: readonly string[];
}

const rawOp = z.object({
  type: z.enum(['add', 'modify', 'remove', 'reaffirm']),
  claimId: z.string().optional(),
  phase: z.string().optional(),
  kind: z.string().optional(),
  text: z.string().optional(),
  reason: z.string().optional(),
  evidence: z.array(z.string()).optional(),
});
const rawDraft = z.object({ operations: z.array(z.unknown()) });

const DEFAULT_KIND: Record<string, ClaimKind> = {
  constitution: 'decision',
  stories: 'acceptance_criterion',
};
const CLAIM_KINDS: readonly ClaimKind[] = ['decision', 'requirement', 'acceptance_criterion'];

/** The model's reply may wrap the JSON in prose or a code fence; take the outermost object. */
function extractJson(reply: string): unknown {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The draft reply held no JSON object');
  try {
    return JSON.parse(reply.slice(start, end + 1));
  } catch {
    throw new Error('The draft reply was not valid JSON');
  }
}

/**
 * Parses a drafted change at the boundary. Nothing the model says about a requirement is trusted:
 * a target must name a live claim by ID, its wording comes from the registry, and evidence must be
 * on the allowlist. Anything that fails is dropped with a note rather than guessed at.
 */
export function parseDraft(reply: string, context: DraftContext): ParsedDraft {
  const parsed = rawDraft.safeParse(extractJson(reply));
  if (!parsed.success) throw new Error('The draft reply had no "operations" list');

  const byClaimId = new Map(context.claims.map((claim) => [claim.claimId, claim]));
  const allowedEvidence = new Set(context.evidenceSourceIds);
  const targeted = new Set<string>();
  const ops: DraftOpInput[] = [];
  const notes: string[] = [];

  for (const [index, candidate] of parsed.data.operations.entries()) {
    const label = `Drafted edit ${index + 1}`;
    const item = rawOp.safeParse(candidate);
    if (!item.success) {
      notes.push(`${label} was not a recognisable edit and was dropped.`);
      continue;
    }
    const raw = item.data;
    const reason = raw.reason?.trim() || 'No reason was drafted.';
    const evidenceSourceIds = [...new Set(raw.evidence ?? [])].filter((id) => allowedEvidence.has(id));
    const text = raw.text?.trim() ?? '';

    if (raw.type === 'add') {
      const phaseId = raw.phase?.trim() ?? '';
      if (!context.phasesWithDocuments.includes(phaseId)) {
        notes.push(`${label} added to "${phaseId || 'no phase'}", which has no document, and was dropped.`);
        continue;
      }
      if (!text) {
        notes.push(`${label} added an empty requirement and was dropped.`);
        continue;
      }
      const kind = CLAIM_KINDS.includes(raw.kind as ClaimKind)
        ? (raw.kind as ClaimKind)
        : (DEFAULT_KIND[phaseId] ?? 'requirement');
      ops.push({ reason, evidenceSourceIds, op: { type: 'add', phaseId, kind, text } });
      continue;
    }

    const claim = raw.claimId ? byClaimId.get(raw.claimId.trim()) : undefined;
    if (!claim) {
      notes.push(`${label} targeted ${raw.claimId?.trim() || 'no requirement'}, which is not a current requirement, and was dropped.`);
      continue;
    }
    if (targeted.has(claim.ref)) {
      notes.push(`${label} targeted ${claim.claimId} a second time and was dropped.`);
      continue;
    }
    if (raw.type === 'modify' && (!text || text === claim.text.trim())) {
      notes.push(`${label} did not change the wording of ${claim.claimId} and was dropped.`);
      continue;
    }
    targeted.add(claim.ref);
    const base = { claim: claim.ref, baseText: claim.text };
    ops.push({
      reason,
      evidenceSourceIds,
      op: raw.type === 'modify' ? { type: 'modify', ...base, text } : { type: raw.type, ...base },
    });
  }

  const missingRegression =
    context.kind === 'bugfix' &&
    !ops.some((input) => input.op.type === 'add' && input.op.kind === 'acceptance_criterion');

  return { ops, notes, missingRegression };
}
