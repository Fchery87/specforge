'use node';

import { action } from '../_generated/server';
import { internal as internalApi } from '../_generated/api';
import { api } from '../_generated/api';
import { v } from 'convex/values';
import { getParallelBatches } from '../../lib/specification/dependency-graph';

export const generateAllPhases = action({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const project = await ctx.runQuery(internalApi.internal.getProjectInternal, {
      projectId: args.projectId,
    });
    if (!project || project.userId !== identity.subject) throw new Error('Forbidden');

    // Get all phase statuses
    const phases = await ctx.runQuery(internalApi.internal.getProjectPhasesInternal, {
      projectId: args.projectId,
    });
    const skippedPhases: string[] = project.skippedPhases ?? [];
    const phaseStatusMap = new Map(
      (phases ?? []).map((p: { phaseId: string; status: string }) => [p.phaseId, p.status])
    );
    // Treat skipped phases as resolved
    for (const skipped of skippedPhases) {
      phaseStatusMap.set(skipped, 'skipped');
    }

    // Get batches in dependency order
    const batches = getParallelBatches(skippedPhases);
    let scheduled = 0;

    for (const batch of batches) {
      for (const phaseId of batch) {
        const status = phaseStatusMap.get(phaseId);
        // Only schedule phases that haven't started yet.
        // Phases with 'error' status require manual per-phase retry.
        // Phases with 'ready' or 'generating' status are intentionally skipped.
        if (status === 'pending' || status === undefined) {
          await ctx.scheduler.runAfter(0, api.actions.generatePhase.generatePhase, {
            projectId: args.projectId,
            phaseId,
          });
          scheduled++;
        }
      }
    }

    return { scheduled };
  },
});
