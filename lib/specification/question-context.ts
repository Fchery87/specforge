import type { PhaseQuestion } from './question-model';

/** The locked constraints a project's template carries, as far as the question prompts use them. */
export interface LockedConstraints {
  architecture?: string;
  stateManagement?: string;
  apiDesign?: string;
  securityProtocols?: string[];
}

export interface UpstreamPhaseContext {
  phaseId: string;
  questions: readonly PhaseQuestion[];
  claims: ReadonlyArray<{ claimId: string; text: string }>;
}

/** Enough to carry a phase's requirements without letting them crowd out the question prompt. */
const MAX_CLAIMS_PER_PHASE = 40;
const MAX_CLAIM_CHARS = 200;

const DESCRIPTION_LIMIT = 3000;

/**
 * The project description as a phase reads it. Early phases read all of it. Later phases read the
 * first part and are pointed at the approved documents, which have absorbed the rest.
 */
export function descriptionForPhase(description: string, phaseId: string): string {
  if (phaseId === 'constitution' || phaseId === 'brief') return description;
  if (description.length <= DESCRIPTION_LIMIT) return description;
  return `${description.slice(0, DESCRIPTION_LIMIT)}\n\n[... Project description truncated for downstream phase. Refer to approved upstream Constitution and Brief ...]`;
}

function constraintBlock(constraints: LockedConstraints | undefined): string | null {
  if (!constraints) return null;
  const parts: string[] = [];
  if (constraints.architecture) parts.push(`Architecture: ${constraints.architecture}`);
  if (constraints.stateManagement) parts.push(`State Management: ${constraints.stateManagement}`);
  if (constraints.apiDesign) parts.push(`API Design: ${constraints.apiDesign}`);
  if (constraints.securityProtocols?.length) {
    parts.push(`Security Protocols: ${constraints.securityProtocols.join(', ')}`);
  }
  return parts.length > 0 ? `[Constitution Constraints]\n${parts.join('\n')}` : null;
}

function answeredBlock(phase: UpstreamPhaseContext): string | null {
  const lines = phase.questions
    .filter((question) => question.answer?.trim())
    .map((question) => {
      const assumed =
        question.answerOrigin === 'drafted' ? ' (assumed by the assistant, not reviewed)' : '';
      return `Q: [${phase.phaseId}] ${question.text}\nA: ${question.answer}${assumed}`;
    });
  return lines.length > 0 ? lines.join('\n\n') : null;
}

function requirementsBlock(phase: UpstreamPhaseContext): string | null {
  if (phase.claims.length === 0) return null;
  const listed = phase.claims.slice(0, MAX_CLAIMS_PER_PHASE).map((claim) => {
    const text =
      claim.text.length > MAX_CLAIM_CHARS ? `${claim.text.slice(0, MAX_CLAIM_CHARS)}…` : claim.text;
    return `- ${claim.claimId} ${text}`;
  });
  const omitted = phase.claims.length - listed.length;
  return [
    `[Approved requirements in ${phase.phaseId}]`,
    ...listed,
    ...(omitted > 0 ? [`(${omitted} more not listed)`] : []),
  ].join('\n');
}

/**
 * What the question prompts know about the project before they ask anything: the locked constraints,
 * and for every upstream phase the answers given and the requirements the phase's document produced.
 *
 * The requirements matter as much as the answers. A decision usually reaches the document in
 * different words than the answer, and "do not ask what is already decided" can only hold when the
 * prompt can see the decision.
 */
export function formatQuestionContext(input: {
  constraints?: LockedConstraints;
  upstream: readonly UpstreamPhaseContext[];
}): string {
  const blocks: Array<string | null> = [constraintBlock(input.constraints)];
  for (const phase of input.upstream) {
    blocks.push(answeredBlock(phase), requirementsBlock(phase));
  }
  return blocks.filter((block): block is string => block !== null).join('\n\n');
}
