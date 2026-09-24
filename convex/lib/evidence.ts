import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import {
  createEvidenceDigest,
  createEvidenceExcerpt,
  extractClaimCandidates,
  normalizeRepositoryPath,
} from '../../lib/evidence';

export type EvidenceKind = 'answer' | 'repository_file' | 'user_note';

export async function reconcileArtifactClaims(
  ctx: MutationCtx,
  args: {
    projectId: Id<'projects'>;
    phaseId: string;
    artifactId: Id<'artifacts'>;
    content: string;
    evidenceSourceIds?: Id<'evidenceSources'>[];
  },
) {
  const artifact = await ctx.db.get(args.artifactId);
  const project = await ctx.db.get(args.projectId);
  if (!artifact || !project || artifact.projectId !== args.projectId || artifact.phaseId !== args.phaseId) {
    throw new Error('Artifact does not belong to the project and phase');
  }
  const allowedSourceIds = new Set((args.evidenceSourceIds ?? []).map(String));
  const candidates = extractClaimCandidates(args.content, args.phaseId, allowedSourceIds);
  const currentClaims = (await ctx.db
    .query('claims')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect())
    .filter((claim) => claim.phaseId === args.phaseId && claim.retiredAt === undefined);
  const priorArtifactRevisions = new Set(
    currentClaims
      .filter((claim) => claim.artifactVersion !== undefined)
      .map((claim) => `${claim.artifactId}:v${claim.artifactVersion}`),
  );
  const verificationResults = await ctx.db
    .query('verificationResults')
    .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
    .collect();
  const checkedAt = Date.now();
  for (const result of verificationResults) {
    const samePhaseChanged = result.phaseId === args.phaseId;
    const referencedRevisionChanged = result.artifactVersionSet?.some((revision) => priorArtifactRevisions.has(revision));
    if (samePhaseChanged || referencedRevisionChanged) {
      await ctx.db.patch(result._id, { outdatedAt: checkedAt });
    }
  }
  const unused = new Map(currentClaims.map((claim) => [claim.text.trim().toLowerCase(), claim]));
  const latestVersion = await ctx.db
    .query('artifactVersions')
    .withIndex('by_artifact', (q) => q.eq('artifactId', args.artifactId))
    .order('desc')
    .first();
  const artifactVersion = (latestVersion?.version ?? 0) + 1;
  const now = checkedAt;
  let nextClaimNumber = project.nextClaimNumber ?? 1;

  for (const candidate of candidates) {
    const key = candidate.text.toLowerCase();
    const previous = unused.get(key);
    if (previous) {
      unused.delete(key);
      const addedLinks = await attachSuggestedEvidence(ctx, {
        projectId: args.projectId,
        claimId: previous._id,
        sourceIds: candidate.sourceIds ?? [],
        allowedSourceIds,
      });
      await ctx.db.patch(previous._id, {
        artifactId: args.artifactId,
        artifactVersion,
        ...(addedLinks ? { reviewStatus: 'needs_review' as const } : {}),
        updatedAt: now,
      });
      continue;
    }
    const claimId = `REQ-${String(nextClaimNumber++).padStart(4, '0')}`;
    const id = await ctx.db.insert('claims', {
      projectId: args.projectId,
      phaseId: args.phaseId,
      claimId,
      artifactId: args.artifactId,
      artifactVersion,
      kind: candidate.kind,
      text: candidate.text,
      decisionStatus: 'proposed',
      reviewStatus: 'needs_review',
      createdAt: now,
      updatedAt: now,
    });
    await attachSuggestedEvidence(ctx, {
      projectId: args.projectId,
      claimId: id,
      sourceIds: candidate.sourceIds ?? [],
      allowedSourceIds,
    });
  }
  for (const claim of unused.values()) {
    await ctx.db.patch(claim._id, { retiredAt: now, updatedAt: now });
  }
  if (nextClaimNumber !== (project.nextClaimNumber ?? 1)) {
    await ctx.db.patch(args.projectId, { nextClaimNumber });
  }
  return candidates.length;
}

async function attachSuggestedEvidence(
  ctx: MutationCtx,
  args: {
    projectId: Id<'projects'>;
    claimId: Id<'claims'>;
    sourceIds: string[];
    allowedSourceIds: Set<string>;
  },
): Promise<boolean> {
  let added = false;
  const existing = await ctx.db
    .query('evidenceLinks')
    .withIndex('by_claim', (q) => q.eq('claimId', args.claimId))
    .collect();
  const linkedIds = new Set(existing.map((link) => String(link.sourceId)));
  for (const sourceId of args.sourceIds) {
    if (!args.allowedSourceIds.has(sourceId) || linkedIds.has(sourceId)) continue;
    const source = await ctx.db.get(sourceId as Id<'evidenceSources'>);
    if (!source || source.projectId !== args.projectId) continue;
    await ctx.db.insert('evidenceLinks', {
      projectId: args.projectId,
      claimId: args.claimId,
      sourceId: source._id,
      supportStatus: 'suggested',
      createdAt: Date.now(),
    });
    added = true;
  }
  return added;
}

export async function captureEvidenceSource(
  ctx: MutationCtx,
  args: {
    projectId: Id<'projects'>;
    sourceKey: string;
    kind: EvidenceKind;
    locator: string;
    revisionLabel: string;
    content: string;
    capturedBy: string;
    origin?: 'user' | 'assistant' | 'repository_scan';
    commitSha?: string;
  },
) {
  const locator =
    args.kind === 'repository_file'
      ? normalizeRepositoryPath(args.locator)
      : args.locator.trim();
  if (!locator) throw new Error('Evidence locator must not be empty');
  if (args.content.length > 100_000) {
    throw new Error('Evidence source exceeds the 100 KB capture limit');
  }

  const contentHash = await createEvidenceDigest(args.content);
  const revisions = await ctx.db
    .query('evidenceSources')
    .withIndex('by_source', (q) => q.eq('projectId', args.projectId).eq('sourceKey', args.sourceKey))
    .collect();
  const latest = revisions.sort((a, b) => b.revision - a.revision)[0];
  if (latest?.contentHash === contentHash && latest.commitSha === args.commitSha) return latest;

  const now = Date.now();
  const sourceId = await ctx.db.insert('evidenceSources', {
    projectId: args.projectId,
    sourceKey: args.sourceKey,
    revision: (latest?.revision ?? 0) + 1,
    kind: args.kind,
    locator,
    revisionLabel: args.revisionLabel.slice(0, 160),
    contentHash,
    excerpt: createEvidenceExcerpt(args.content),
    capturedAt: now,
    capturedBy: args.capturedBy,
    ...(args.origin ? { origin: args.origin } : {}),
    ...(args.commitSha ? { commitSha: args.commitSha } : {}),
  });

  if (latest) {
    for (const revision of revisions) await markEvidenceImpact(ctx, revision._id, now);
  }
  return await ctx.db.get(sourceId);
}

export async function markEvidenceImpact(
  ctx: MutationCtx,
  oldSourceId: Id<'evidenceSources'>,
  now: number,
) {
  const links = await ctx.db
    .query('evidenceLinks')
    .withIndex('by_source', (q) => q.eq('sourceId', oldSourceId))
    .collect();

  for (const link of links) {
    const claim = await ctx.db.get(link.claimId);
    if (!claim) continue;
    await ctx.db.patch(claim._id, {
      reviewStatus: 'needs_review',
      updatedAt: now,
    });
    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_project', (q) => q.eq('projectId', claim.projectId))
      .collect();
    for (const ticket of tickets) {
      if (ticket.claimIds?.includes(claim.claimId)) {
        await ctx.db.patch(ticket._id, { evidenceReviewStatus: 'needs_review', updatedAt: now });
      }
    }

    const phase = await ctx.db
      .query('phases')
      .withIndex('by_project', (q) => q.eq('projectId', claim.projectId))
      .filter((q) => q.eq(q.field('phaseId'), claim.phaseId))
      .first();
    if (phase) {
      await ctx.db.patch(phase._id, {
        isStale: true,
        staleReason: 'Evidence source changed',
        staleSince: now,
        upstreamChanges: [...new Set([...(phase.upstreamChanges ?? []), claim.phaseId])],
      });
    }
  }

  const source = await ctx.db.get(oldSourceId);
  if (!source) return;
  const results = await ctx.db
    .query('verificationResults')
    .withIndex('by_project', (q) => q.eq('projectId', source.projectId))
    .collect();
  for (const result of results) {
    if (result.sourceRevisionSet?.includes(String(oldSourceId))) {
      await ctx.db.patch(result._id, { outdatedAt: now });
    }
  }
}
