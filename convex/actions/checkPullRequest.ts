'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import { rateLimiter } from '../rateLimiter';
import { openLlmSession, rethrowLlmError } from './llmSession';
import { readGitHubToken } from './githubToken';
import { createEvidenceDigest } from '../../lib/evidence';
import {
  fetchCommitRange,
  fetchPullRequest,
  GitHubReadError,
  listPullRequests as listRepositoryPullRequests,
  type PullRequestSummary,
  type RepoAccess,
} from '../../lib/github/pulls';
import { CHECK_REPLY_TOKENS } from '../../lib/verification/budget';
import { CHECK_SYSTEM_PROMPT } from '../../lib/verification/check-prompt';
import { splitUnifiedDiff } from '../../lib/verification/diff';
import { runCheck, type CheckInput } from '../../lib/verification/run-check';
import type { CheckContext } from '../verification';

const sourceArg = v.union(
  v.object({ kind: v.literal('pull_request'), number: v.number() }),
  v.object({ kind: v.literal('range'), base: v.string(), head: v.string() }),
  v.object({ kind: v.literal('pasted'), diff: v.string() }),
);

async function requireUser(ctx: ActionCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity.subject;
}

async function repositoryAccess(ctx: ActionCtx, context: CheckContext): Promise<RepoAccess> {
  if (!context.repository) throw new Error('This project has no connected repository. Connect one on the project page, or paste a diff.');
  const token = await readGitHubToken(ctx);
  if (!token) throw new Error('GitHub is not connected. Connect GitHub in Settings, or paste a diff.');
  return { owner: context.repository.owner, repo: context.repository.name, token };
}

/** GitHub's errors already say what to do; anything else is rethrown as it is. */
async function readFromGitHub<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof GitHubReadError) throw new Error(error.message);
    throw error;
  }
}

async function readChange(
  ctx: ActionCtx,
  context: CheckContext,
  source: typeof sourceArg.type,
): Promise<CheckInput['change']> {
  if (source.kind === 'pasted') {
    return { source: { kind: 'pasted' }, title: '', body: '', commitMessages: [], files: splitUnifiedDiff(source.diff), notes: [] };
  }
  const access = await repositoryAccess(ctx, context);
  return readFromGitHub(() =>
    source.kind === 'pull_request' ? fetchPullRequest(access, source.number) : fetchCommitRange(access, source.base, source.head),
  );
}

/** Checks a pull request, a commit range or a pasted diff against the project's requirements. */
export const checkPullRequest = action({
  args: { projectId: v.id('projects'), source: sourceArg },
  handler: async (ctx, args): Promise<{ checkId: Id<'verificationResults'> }> => {
    const userId = await requireUser(ctx);
    await rateLimiter.limit(ctx, 'checkPullRequest', { key: userId, throws: true });

    const context: CheckContext = await ctx.runQuery(internalApi.verification.getCheckContextInternal, {
      projectId: args.projectId,
      userId,
    });
    const change = await readChange(ctx, context, args.source);
    const { client, model } = await openLlmSession(ctx);

    let outcome;
    try {
      outcome = await runCheck({ projectTitle: context.projectTitle, change, claims: context.claims, changes: context.changes, model }, async (prompt) => {
        const response = await client.complete(prompt, {
          model: model.id,
          maxTokens: Math.min(CHECK_REPLY_TOKENS, model.maxOutputTokens),
          temperature: 0.1,
          systemPrompt: CHECK_SYSTEM_PROMPT,
        });
        return response.content;
      });
    } catch (error) {
      rethrowLlmError(error);
    }

    const judged = new Set(outcome.verdicts.map((verdict) => verdict.claimId));
    const judgedClaims = context.claims.filter((claim) => judged.has(claim.claimId));
    const checkId = await ctx.runMutation(internalApi.internal.createVerificationResult, {
      projectId: args.projectId,
      checkedAt: Date.now(),
      artifactVersionSet: [...new Set(judgedClaims.map((claim) => `${claim.artifactId}:v${claim.artifactVersion ?? 1}`))],
      diffDigest: await createEvidenceDigest(change.files.map((file) => `${file.path}\n${file.patch ?? ''}`).join('\n')),
      findings: [],
      overallScore: outcome.overallScore,
      status: outcome.status,
      source: outcome.source,
      verdicts: outcome.verdicts,
      coverage: outcome.coverage,
      otherFindings: outcome.otherFindings,
      notes: outcome.notes,
    });
    return { checkId };
  },
});

export type PullRequestPicker =
  | { connected: false; reason: string }
  | { connected: true; repository: string; pullRequests: PullRequestSummary[] };

/** The connected repository's open and recently merged pull requests, for the check picker. */
export const listPullRequests = action({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args): Promise<PullRequestPicker> => {
    const userId = await requireUser(ctx);
    await rateLimiter.limit(ctx, 'listPullRequests', { key: userId, throws: true });
    const context: CheckContext = await ctx.runQuery(internalApi.verification.getCheckContextInternal, {
      projectId: args.projectId,
      userId,
    });
    if (!context.repository) return { connected: false, reason: 'This project has no connected repository.' };
    const token = await readGitHubToken(ctx);
    if (!token) return { connected: false, reason: 'GitHub is not connected.' };
    const access = { owner: context.repository.owner, repo: context.repository.name, token };
    return {
      connected: true,
      repository: `${context.repository.owner}/${context.repository.name}`,
      pullRequests: await readFromGitHub(() => listRepositoryPullRequests(access)),
    };
  },
});
