import type { ActionCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { internal as internalApi } from '../_generated/api';
import { getUpstreamPhases } from '../../lib/specification/dependency-graph';
import {
  descriptionForPhase,
  formatQuestionContext,
  type UpstreamPhaseContext,
} from '../../lib/specification/question-context';
import type { PhaseQuestion } from '../../lib/specification/question-model';

export interface QuestionContext {
  /** Locked constraints and every upstream phase's answers and requirements. Empty when there are none. */
  upstream: string;
  /** The repository the project is connected to, when there is one. */
  codebase?: string;
  /** The project description as this phase reads it. */
  description: string;
}

async function loadCodebaseContext(
  ctx: ActionCtx,
  projectId: Id<'projects'>,
): Promise<string | undefined> {
  try {
    const codebase = await ctx.runQuery(internalApi.internal.getCodebaseInternal, { projectId });
    if (!codebase) return undefined;
    const keyFilePaths = (codebase.keyFiles || []).map((f: { path: string }) => f.path).slice(0, 10);
    return `Repository: ${codebase.repoOwner}/${codebase.repoName} (${codebase.defaultBranch})\nKey Files: ${keyFilePaths.join(', ')}`;
  } catch {
    // The repository is optional context.
    return undefined;
  }
}

/**
 * Everything the question prompts and the batch answerer share about where the project stands.
 *
 * Reads every phase the given one depends on, directly or through another, so a question is asked
 * knowing what the whole chain above it decided.
 */
export async function loadQuestionContext(
  ctx: ActionCtx,
  project: Doc<'projects'>,
  phaseId: string,
): Promise<QuestionContext> {
  const upstream: UpstreamPhaseContext[] = [];
  for (const upstreamPhaseId of getUpstreamPhases(phaseId)) {
    const [phase, claims] = await Promise.all([
      ctx.runQuery(internalApi.internal.getPhaseInternal, {
        projectId: project._id,
        phaseId: upstreamPhaseId,
      }),
      ctx.runQuery(internalApi.evidence.listLiveClaimIdsInternal, {
        projectId: project._id,
        phaseId: upstreamPhaseId,
      }),
    ]);
    upstream.push({
      phaseId: upstreamPhaseId,
      questions: (phase?.questions ?? []) as PhaseQuestion[],
      claims,
    });
  }

  return {
    upstream: formatQuestionContext({
      constraints: project.constitutionTemplate?.lockedConstraints,
      upstream,
    }),
    codebase: await loadCodebaseContext(ctx, project._id),
    description: descriptionForPhase(project.description, phaseId),
  };
}
