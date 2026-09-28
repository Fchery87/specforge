'use node';

import { action } from '../_generated/server';
import { v } from 'convex/values';
import { rateLimiter } from '../rateLimiter';
import { openLlmSession, rethrowLlmError } from './llmSession';

const QUICK_SPEC_SYSTEM_PROMPT =
  'You are a software architect. Produce clear, concise, actionable specifications.';

export function buildQuickSpecPrompt(title: string, description: string): string {
  return `Generate a concise implementation spec for the following:

Title: ${title}
Description: ${description}

Produce a focused spec in markdown with these sections:
## Architecture Decisions
Brief bullet list of key architectural choices.

## Implementation Steps
Numbered list of 3-5 concrete implementation steps.

## Technical Considerations
Brief notes on key constraints, security, or performance considerations.

## Architecture Diagram
A Mermaid diagram showing the key components and their relationships.

Keep the spec concise and actionable. Use mermaid fences for the diagram.`;
}

export const generateQuickSpec = action({
  args: {
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args): Promise<{ content: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    await rateLimiter.limit(ctx, 'generateQuickSpec', { key: identity.subject, throws: true });

    const { client, modelId } = await openLlmSession(ctx);
    try {
      const response = await client.complete(buildQuickSpecPrompt(args.title, args.description), {
        model: modelId,
        maxTokens: 2048,
        temperature: 0.3,
        systemPrompt: QUICK_SPEC_SYSTEM_PROMPT,
      });
      return { content: response.content };
    } catch (error) {
      rethrowLlmError(error);
    }
  },
});
