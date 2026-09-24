import { internalQuery, mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';

async function requireProjectOwner(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<'projects'>,
) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error('Project not found');
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || identity.subject !== project.userId) throw new Error('Forbidden');
  return { project, identity };
}

export const listWorkspace = query({
  args: { projectId: v.id('projects'), artifactId: v.optional(v.id('artifacts')) },
  handler: async (ctx, args) => {
    await requireProjectOwner(ctx, args.projectId);
    const sources = await ctx.db
      .query('evidenceSources')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    const allClaims = await ctx.db
      .query('claims')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    const claims = allClaims
      .filter((claim) => claim.retiredAt === undefined)
      .filter((claim) => !args.artifactId || claim.artifactId === args.artifactId);
    const claimRows = await Promise.all(
      claims.map(async (claim) => {
        const links = await ctx.db
          .query('evidenceLinks')
          .withIndex('by_claim', (q) => q.eq('claimId', claim._id))
          .collect();
        const linkedSources = await Promise.all(
          links.map(async (link) => ({
            ...link,
            source: await ctx.db.get(link.sourceId),
          })),
        );
        return { ...claim, links: linkedSources };
      }),
    );
    return { sources: sources.sort((a, b) => b.capturedAt - a.capturedAt), claims: claimRows };
  },
});

export const listClaimsInternal = internalQuery({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const claims = await ctx.db
      .query('claims')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    return await Promise.all(
      claims.filter((claim) => claim.retiredAt === undefined).map(async (claim) => {
        const links = await ctx.db
          .query('evidenceLinks')
          .withIndex('by_claim', (q) => q.eq('claimId', claim._id))
          .collect();
        return {
          ...claim,
          links: await Promise.all(links.map(async (link) => ({
            ...link,
            source: await ctx.db.get(link.sourceId),
          }))),
          sourceRevisionIds: links
            .filter((link) => link.supportStatus === 'confirmed')
            .map((link) => String(link.sourceId)),
        };
      }),
    );
  },
});

export const listEvidenceSourcesInternal = internalQuery({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const sources = await ctx.db
      .query('evidenceSources')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect();
    return sources.sort((a, b) => b.capturedAt - a.capturedAt).slice(0, 40);
  },
});

export const listVerificationResults = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    await requireProjectOwner(ctx, args.projectId);
    return await ctx.db
      .query('verificationResults')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .take(10);
  },
});

export const addNote = mutation({
  args: { projectId: v.id('projects'), note: v.string() },
  handler: async (ctx, args) => {
    const { identity } = await requireProjectOwner(ctx, args.projectId);
    const note = args.note.trim();
    if (!note || note.length > 20_000) {
      throw new Error('Evidence note must be between 1 and 20,000 characters');
    }
    const { captureEvidenceSource } = await import('./lib/evidence');
    return await captureEvidenceSource(ctx, {
      projectId: args.projectId,
      sourceKey: `note:${crypto.randomUUID()}`,
      kind: 'user_note',
      locator: 'user-note',
      revisionLabel: 'User note',
      content: note,
      capturedBy: identity.subject,
      origin: 'user',
    });
  },
});

export const createClaim = mutation({
  args: {
    projectId: v.id('projects'),
    artifactId: v.id('artifacts'),
    text: v.string(),
    kind: v.union(
      v.literal('decision'),
      v.literal('requirement'),
      v.literal('acceptance_criterion'),
    ),
    decisionStatus: v.union(
      v.literal('confirmed'),
      v.literal('observed'),
      v.literal('proposed'),
      v.literal('unresolved'),
    ),
    sourceIds: v.array(v.id('evidenceSources')),
  },
  handler: async (ctx, args) => {
    const { project, identity } = await requireProjectOwner(ctx, args.projectId);
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact || artifact.projectId !== args.projectId) {
      throw new Error('Artifact does not belong to this project');
    }
    const text = args.text.trim();
    if (!text || text.length > 4_000) throw new Error('Claim text must be 1 to 4,000 characters');
    const sources = await Promise.all(args.sourceIds.map((sourceId) => ctx.db.get(sourceId)));
    if (sources.some((source) => !source || source.projectId !== args.projectId)) {
      throw new Error('Evidence source does not belong to this project');
    }

    const number = project.nextClaimNumber ?? 1;
    const claimId = `REQ-${String(number).padStart(4, '0')}`;
    const now = Date.now();
    const id = await ctx.db.insert('claims', {
      projectId: args.projectId,
      phaseId: artifact.phaseId,
      claimId,
      artifactId: args.artifactId,
      kind: args.kind,
      text,
      decisionStatus: args.decisionStatus,
      reviewStatus: args.sourceIds.length ? 'needs_review' : 'needs_review',
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.projectId, { nextClaimNumber: number + 1 });
    for (const sourceId of args.sourceIds) {
      await ctx.db.insert('evidenceLinks', {
        projectId: args.projectId,
        claimId: id,
        sourceId,
        supportStatus: 'suggested',
        createdAt: now,
      });
    }
    await ctx.db.insert('evidenceReviews', {
      projectId: args.projectId,
      claimId: id,
      actorId: identity.subject,
      action: args.decisionStatus === 'unresolved' ? 'unresolved' : 'revised',
      reviewedAt: now,
    });
    return { id, claimId };
  },
});

export const reviewClaim = mutation({
  args: {
    claimId: v.id('claims'),
    action: v.union(v.literal('confirmed'), v.literal('revised'), v.literal('unresolved')),
    text: v.optional(v.string()),
    decisionStatus: v.optional(v.union(
      v.literal('confirmed'),
      v.literal('observed'),
      v.literal('proposed'),
      v.literal('unresolved'),
    )),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error('Claim not found');
    const { identity } = await requireProjectOwner(ctx, claim.projectId);
    const text = args.text?.trim();
    if (text !== undefined && (!text || text.length > 4_000)) {
      throw new Error('Claim text must be 1 to 4,000 characters');
    }
    const status = args.decisionStatus ?? (args.action === 'unresolved' ? 'unresolved' : claim.decisionStatus);
    const now = Date.now();
    await ctx.db.patch(claim._id, {
      ...(text ? { text } : {}),
      decisionStatus: status,
      reviewStatus: 'current',
      updatedAt: now,
    });
    await ctx.db.insert('evidenceReviews', {
      projectId: claim.projectId,
      claimId: claim._id,
      actorId: identity.subject,
      action: args.action,
      ...(text ? { note: text } : {}),
      reviewedAt: now,
    });
    const tickets = await ctx.db
      .query('tickets')
      .withIndex('by_project', (q) => q.eq('projectId', claim.projectId))
      .collect();
    const linkedClaims = await ctx.db
      .query('claims')
      .withIndex('by_project', (q) => q.eq('projectId', claim.projectId))
      .collect();
    for (const ticket of tickets) {
      if (!ticket.claimIds?.includes(claim.claimId)) continue;
      const isStale = ticket.claimIds.some((id) =>
        linkedClaims.some((item) => item.claimId === id && item.reviewStatus === 'needs_review' && item.retiredAt === undefined),
      );
      await ctx.db.patch(ticket._id, { evidenceReviewStatus: isStale ? 'needs_review' : 'current', updatedAt: now });
    }
    const artifact = await ctx.db.get(claim.artifactId);
    if (artifact) {
      const phase = await ctx.db
        .query('phases')
        .withIndex('by_project', (q) => q.eq('projectId', claim.projectId))
        .filter((q) => q.eq(q.field('phaseId'), artifact.phaseId))
        .first();
      const unresolvedClaims = await ctx.db
        .query('claims')
        .withIndex('by_artifact', (q) => q.eq('artifactId', artifact._id))
        .filter((q) => q.eq(q.field('reviewStatus'), 'needs_review'))
        .collect();
      const phaseClaims = await ctx.db
        .query('claims')
        .withIndex('by_project', (q) => q.eq('projectId', claim.projectId))
        .filter((q) => q.eq(q.field('phaseId'), artifact.phaseId))
        .collect();
      const hasUnreviewedPhaseClaims = phaseClaims.some((item) => item.retiredAt === undefined && item.reviewStatus === 'needs_review');
      if (phase && unresolvedClaims.filter((item) => item.retiredAt === undefined).length === 0 && !hasUnreviewedPhaseClaims && phase.staleReason === 'Evidence source changed') {
        await ctx.db.patch(phase._id, { isStale: false, staleReason: undefined, staleSince: undefined });
      }
    }
  },
});

export const reviewEvidenceLink = mutation({
  args: {
    linkId: v.id('evidenceLinks'),
    supportStatus: v.union(v.literal('confirmed'), v.literal('rejected')),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error('Evidence link not found');
    const { identity } = await requireProjectOwner(ctx, link.projectId);
    const now = Date.now();
    await ctx.db.patch(link._id, {
      supportStatus: args.supportStatus,
      reviewedAt: now,
      reviewedBy: identity.subject,
    });
    const claim = await ctx.db.get(link.claimId);
    if (claim) {
      const links = await ctx.db
        .query('evidenceLinks')
        .withIndex('by_claim', (q) => q.eq('claimId', claim._id))
        .collect();
      const hasUnreviewed = links.some((item) =>
        item._id === link._id ? false : item.supportStatus === 'suggested',
      );
      const hasConfirmed = links.some((item) =>
        item._id === link._id ? args.supportStatus === 'confirmed' : item.supportStatus === 'confirmed',
      );
      if (!hasUnreviewed && hasConfirmed) {
        await ctx.db.patch(claim._id, { reviewStatus: 'current', updatedAt: now });
      }
    }
  },
});
