'use node';

import { action } from '../_generated/server';
import { internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { parseTicketsFromMarkdown } from '../../lib/ticket-parser';

export const parseTicketsFromArtifact = action({
  args: {
    projectId: v.id('projects'),
    artifactId: v.id('artifacts'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    // Verify the caller owns the project
    const project = await ctx.runQuery(internalApi.internal.getProjectInternal, {
      projectId: args.projectId,
    });
    if (!project || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    // Get artifact content
    const artifact = await ctx.runQuery(internalApi.internal.getArtifactInternal, {
      artifactId: args.artifactId,
    });
    if (!artifact) throw new Error('Artifact not found');

    // Parse tickets from markdown
    const parsed = parseTicketsFromMarkdown(artifact.content);

    // Clear existing tickets for this phase (idempotency)
    await ctx.runMutation(internalApi.internal.deleteTicketsByPhaseInternal, {
      projectId: args.projectId,
      phaseId: artifact.phaseId,
    });

    // Create ticket documents
    const ticketIds: Id<'tickets'>[] = [];
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
        sliceType: ticket.sliceType,
        blockedByTitles: ticket.blockedBy,
        filesToTouch: ticket.filesToTouch,
        order: i,
      });
      ticketIds.push(id);
    }

    // Resolve dependency IDs from blockedBy titles or numeric indices
    for (let i = 0; i < parsed.length; i++) {
      const ticket = parsed[i];
      if (!ticket.blockedBy || ticket.blockedBy.length === 0) continue;

      const dependencyIds: Id<'tickets'>[] = [];
      for (const blockerRef of ticket.blockedBy) {
        const cleanRef = blockerRef.trim().toLowerCase();
        // Check for 1-based numeric or #N index
        const numMatch = cleanRef.match(/^#?(\d+)$/);
        if (numMatch) {
          const targetIndex = parseInt(numMatch[1], 10) - 1;
          if (targetIndex >= 0 && targetIndex < ticketIds.length && targetIndex !== i) {
            dependencyIds.push(ticketIds[targetIndex]);
            continue;
          }
        }

        // Check for matching title or ticket ID prefix (e.g. US-001)
        for (let j = 0; j < parsed.length; j++) {
          if (j === i) continue;
          const otherTitle = parsed[j].title.toLowerCase();
          if (
            otherTitle.includes(cleanRef) ||
            cleanRef.includes(otherTitle) ||
            otherTitle.startsWith(cleanRef)
          ) {
            if (!dependencyIds.includes(ticketIds[j])) {
              dependencyIds.push(ticketIds[j]);
            }
          }
        }
      }

      if (dependencyIds.length > 0) {
        await ctx.runMutation(
          internalApi.internal.updateTicketDependenciesInternal,
          {
            ticketId: ticketIds[i],
            dependencies: dependencyIds,
          },
        );
      }
    }

    return { ticketCount: ticketIds.length, ticketIds };
  },
});
