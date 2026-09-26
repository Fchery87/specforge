'use node';

import { action } from '../_generated/server';
import type { ActionCtx } from '../_generated/server';
import { internal as internalApi } from '../_generated/api';
import { v } from 'convex/values';
import { generateSkillMd } from '../../lib/export/skill-formatter';
import { generateAgentsMd } from '../../lib/export/agents-formatter';
import { createZip, sanitizeZipPathSegment } from '../../lib/zip';
import { rateLimiter } from '../rateLimiter';
import { formatClaimManifest, type ClaimManifestItem } from '../../lib/evidence';

export interface ProjectZipInput {
  project: {
    _id: string;
    title: string;
    description: string;
    _creationTime: number;
  };
  artifacts: Array<{
    phaseId: string;
    title: string;
    content: string;
  }>;
  claims?: ClaimManifestItem[];
}

export function buildProjectZipEntries(input: ProjectZipInput): Array<{ path: string; content: string }> {
  const { project, artifacts, claims } = input;
  const traceabilityManifest = formatClaimManifest(claims ?? []);

  const entries = artifacts.map((a) => ({
    path: `${sanitizeZipPathSegment(a.phaseId)}/${sanitizeZipPathSegment(a.title)}.md`,
    content: a.content,
  }));

  // Generate Agent-Native files
  const artifactMap: Record<string, string> = {};
  artifacts.forEach((a) => {
    artifactMap[a.phaseId] = a.content;
  });

  const exportInput = {
    project: {
      _id: project._id,
      title: project.title,
      description: project.description,
      createdAt: project._creationTime,
    },
    artifacts: artifactMap,
  };

  try {
    const skillContent = `${generateSkillMd(exportInput)}${traceabilityManifest}`;
    entries.push({ path: 'SKILL.md', content: skillContent });

    const agentsContent = `${generateAgentsMd(exportInput)}${traceabilityManifest}`;
    entries.push({ path: 'AGENTS.md', content: agentsContent });
    entries.push({ path: 'CLAUDE.md', content: '@AGENTS.md\n' });
    if (traceabilityManifest) {
      entries.push({ path: 'handoff/requirements.md', content: traceabilityManifest.trimStart() });
    }
  } catch (e) {
    console.warn('Could not generate agent handoff files', e);
  }

  entries.push({
    path: 'handoff/README.md',
    content:
      '# Project Export\n\nExported from SpecForge with Agent-Native files.\n',
  });

  return entries;
}

export const generateProjectZip = action({
  args: { projectId: v.id('projects') },
  handler: async (ctx: ActionCtx, args) => {
    const project = await ctx.runQuery(
      internalApi.internal.getProjectInternal,
      {
        projectId: args.projectId,
      },
    );
    if (!project) throw new Error('Not found');

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || project.userId !== identity.subject)
      throw new Error('Forbidden');

    const userId = identity.tokenIdentifier;
    await rateLimiter.limit(ctx, 'generateProjectZip', {
      key: userId,
      throws: true,
    });
    await rateLimiter.limit(ctx, 'globalZipGen', { throws: true });

    if (project.zipStorageId) {
      await ctx.storage.delete(project.zipStorageId);
    }

    const artifacts = await ctx.runQuery(
      internalApi.internal.getPhaseArtifactsInternal,
      { projectId: args.projectId },
    );
    const claims = await ctx.runQuery(internalApi.evidence.listClaimsInternal, {
      projectId: args.projectId,
    });

    const entries = buildProjectZipEntries({
      project,
      artifacts,
      claims,
    });

    const zipBytes = await createZip(entries);
    const uint8Array = new Uint8Array(zipBytes);
    const blob = new Blob([uint8Array], { type: 'application/zip' });
    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internalApi.internal.saveZipToProject, {
      projectId: args.projectId,
      storageId,
    });

    return { storageId };
  },
});
