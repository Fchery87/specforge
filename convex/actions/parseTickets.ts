'use node';

import { action } from '../_generated/server';
import { internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import { parseTicketsFromMarkdown } from '../../lib/ticket-parser';

export const parseTicketsFromArtifact = action({
  args: {
    projectId: v.id('projects'),
    artifactId: v.id('artifacts'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    // Get artifact content
    const artifact = await ctx.runQuery(internalApi.internal.getArtifactInternal, {
      artifactId: args.artifactId,
    });
    if (!artifact) throw new Error('Artifact not found');

    // Parse tickets from markdown
    const parsed = parseTicketsFromMarkdown(artifact.content);

    // Create ticket documents
    const ticketIds = [];
    for (let i = 0; i < parsed.length; i++) {
      const ticket = parsed[i];
      const id = await ctx.runMutation(internalApi.internal.createTicketInternal, {
        projectId: args.projectId,
        phaseId: artifact.phaseId,
        artifactId: args.artifactId,
        title: ticket.title,
        description: ticket.description,
        acceptanceCriteria: ticket.acceptanceCriteria,
        status: 'todo',
        priority: ticket.priority,
        estimatedEffort: ticket.estimatedEffort,
        order: i,
      });
      ticketIds.push(id);
    }

    return { ticketCount: ticketIds.length, ticketIds };
  },
});
