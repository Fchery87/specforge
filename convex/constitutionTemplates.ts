import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';

/** Pure helper — builds the insert payload for a new template */
export function buildTemplateInsert(
  userId: string,
  name: string,
  description: string,
  constitutionContent: string,
  lockedConstraints?: {
    architecture?: string;
    stateManagement?: string;
    apiDesign?: string;
    securityProtocols?: string[];
  },
) {
  return {
    userId,
    name,
    description,
    constitutionContent,
    lockedConstraints,
    createdAt: Date.now(),
    usageCount: 0,
  };
}

export const listTemplates = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    return await ctx.db
      .query('constitutionTemplates')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .collect();
  },
});

export const saveTemplate = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    constitutionContent: v.string(),
    lockedConstraints: v.optional(
      v.object({
        architecture: v.optional(v.string()),
        stateManagement: v.optional(v.string()),
        apiDesign: v.optional(v.string()),
        securityProtocols: v.optional(v.array(v.string())),
      }),
    ),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    return await ctx.db.insert(
      'constitutionTemplates',
      buildTemplateInsert(
        identity.subject,
        args.name,
        args.description,
        args.constitutionContent,
        args.lockedConstraints,
      ),
    );
  },
});

export const deleteTemplate = mutation({
  args: {
    templateId: v.id('constitutionTemplates'),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error('Not found');
    if (template.userId !== identity.subject) throw new Error('Forbidden');

    await ctx.db.delete(args.templateId);
  },
});

export const incrementUsageCount = mutation({
  args: {
    templateId: v.id('constitutionTemplates'),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error('Not found');
    if (template.userId !== identity.subject) throw new Error('Forbidden');

    await ctx.db.patch(args.templateId, {
      usageCount: (template.usageCount ?? 0) + 1,
    });
  },
});
