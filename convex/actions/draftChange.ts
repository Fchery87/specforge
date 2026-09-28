'use node';

import { action } from '../_generated/server';
import { api, internal as internalApi } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { rateLimiter } from '../rateLimiter';
import { openLlmSession, rethrowLlmError } from './llmSession';
import { DRAFT_SYSTEM_PROMPT } from '../../lib/changes/draft-prompt';
import type { DraftOpInput } from '../../lib/changes/parse-draft';
import { runDraft } from '../../lib/changes/run-draft';
import type { ChangeOpInput } from '../changes';

/** The parser works in plain strings; the IDs it returns were checked against these tables. */
function toChangeOpInput(input: DraftOpInput): ChangeOpInput {
  const evidenceSourceIds = input.evidenceSourceIds as Id<'evidenceSources'>[];
  const { op } = input;
  return {
    reason: input.reason,
    evidenceSourceIds,
    op: op.type === 'add' ? op : { ...op, claim: op.claim as Id<'claims'> },
  };
}

/** Drafts a change's operations from its description and replaces the draft's current ones. */
export const draftChange = action({
  args: { changeId: v.id('changes') },
  handler: async (ctx, args): Promise<{ operations: number; notes: string[] }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    await rateLimiter.limit(ctx, 'draftChange', { key: identity.subject, throws: true });

    const input = await ctx.runQuery(internalApi.changes.getDraftContextInternal, {
      changeId: args.changeId,
      userId: identity.subject,
    });
    const { client, modelId } = await openLlmSession(ctx);

    let draft;
    try {
      draft = await runDraft(input, async (prompt) => {
        const response = await client.complete(prompt, {
          model: modelId,
          maxTokens: 4096,
          temperature: 0.2,
          systemPrompt: DRAFT_SYSTEM_PROMPT,
        });
        return response.content;
      });
    } catch (error) {
      rethrowLlmError(error);
    }

    await ctx.runMutation(api.changes.replaceChangeOps, {
      changeId: args.changeId,
      ops: draft.ops.map(toChangeOpInput),
    });
    return { operations: draft.ops.length, notes: draft.notes };
  },
});
