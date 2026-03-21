import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const getPreferences = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    return prefs ?? null;
  },
});

export const getPinnedProjects = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!prefs || prefs.pinnedProjectIds.length === 0) return [];

    const pinnedProjects = await Promise.all(
      prefs.pinnedProjectIds.map((id: Id<'projects'>) => ctx.db.get(id))
    );

    return pinnedProjects.filter((p) => p !== null);
  },
});

export const pinProject = mutation({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx: MutationCtx, args: { projectId: Id<'projects'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!prefs) {
      await ctx.db.insert('userPreferences', {
        userId: identity.subject,
        pinnedProjectIds: [args.projectId],
        updatedAt: Date.now(),
      });
      return { success: true, action: 'created' };
    }

    const current = prefs.pinnedProjectIds || [];
    if (current.length >= 5) {
      throw new Error('Maximum 5 pinned projects allowed');
    }

    if (current.includes(args.projectId)) {
      return { success: true, action: 'already_pinned' };
    }

    await ctx.db.patch(prefs._id, {
      pinnedProjectIds: [...current, args.projectId],
      updatedAt: Date.now(),
    });

    return { success: true, action: 'pinned' };
  },
});

export const unpinProject = mutation({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx: MutationCtx, args: { projectId: Id<'projects'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!prefs) {
      return { success: true, action: 'no_prefs' };
    }

    const current = prefs.pinnedProjectIds || [];
    if (!current.includes(args.projectId)) {
      return { success: true, action: 'not_pinned' };
    }

    await ctx.db.patch(prefs._id, {
      pinnedProjectIds: current.filter((id: Id<'projects'>) => id !== args.projectId),
      updatedAt: Date.now(),
    });

    return { success: true, action: 'unpinned' };
  },
});

export const reorderPinnedProjects = mutation({
  args: {
    projectIds: v.array(v.id('projects')),
  },
  handler: async (ctx: MutationCtx, args: { projectIds: Id<'projects'>[] }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    if (args.projectIds.length > 5) {
      throw new Error('Maximum 5 pinned projects allowed');
    }

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!prefs) {
      await ctx.db.insert('userPreferences', {
        userId: identity.subject,
        pinnedProjectIds: args.projectIds,
        updatedAt: Date.now(),
      });
      return { success: true };
    }

    await ctx.db.patch(prefs._id, {
      pinnedProjectIds: args.projectIds,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const updateDashboardLayout = mutation({
  args: {
    showAnalytics: v.optional(v.boolean()),
    showActivityFeed: v.optional(v.boolean()),
    defaultSort: v.optional(v.union(
      v.literal('updatedAt'),
      v.literal('createdAt'),
      v.literal('title'),
      v.literal('progress'),
    )),
    defaultFilter: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args: {
    showAnalytics?: boolean;
    showActivityFeed?: boolean;
    defaultSort?: 'updatedAt' | 'createdAt' | 'title' | 'progress';
    defaultFilter?: string;
  }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    const layout = {
      ...prefs?.dashboardLayout,
      showAnalytics: args.showAnalytics ?? prefs?.dashboardLayout?.showAnalytics ?? true,
      showActivityFeed: args.showActivityFeed ?? prefs?.dashboardLayout?.showActivityFeed ?? true,
      defaultSort: args.defaultSort ?? prefs?.dashboardLayout?.defaultSort ?? 'updatedAt',
      defaultFilter: args.defaultFilter ?? prefs?.dashboardLayout?.defaultFilter,
    };

    if (!prefs) {
      await ctx.db.insert('userPreferences', {
        userId: identity.subject,
        pinnedProjectIds: [],
        dashboardLayout: layout,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(prefs._id, {
        dashboardLayout: layout,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const updateTheme = mutation({
  args: {
    theme: v.union(v.literal('light'), v.literal('dark'), v.literal('system')),
  },
  handler: async (ctx: MutationCtx, args: { theme: 'light' | 'dark' | 'system' }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    if (!prefs) {
      await ctx.db.insert('userPreferences', {
        userId: identity.subject,
        pinnedProjectIds: [],
        theme: args.theme,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(prefs._id, {
        theme: args.theme,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const updateEmailNotifications = mutation({
  args: {
    generationComplete: v.optional(v.boolean()),
    driftDetected: v.optional(v.boolean()),
    weeklyDigest: v.optional(v.boolean()),
  },
  handler: async (ctx: MutationCtx, args: {
    generationComplete?: boolean;
    driftDetected?: boolean;
    weeklyDigest?: boolean;
  }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    const emailNotifications = {
      ...prefs?.emailNotifications,
      generationComplete: args.generationComplete ?? prefs?.emailNotifications?.generationComplete ?? true,
      driftDetected: args.driftDetected ?? prefs?.emailNotifications?.driftDetected ?? true,
      weeklyDigest: args.weeklyDigest ?? prefs?.emailNotifications?.weeklyDigest ?? false,
    };

    if (!prefs) {
      await ctx.db.insert('userPreferences', {
        userId: identity.subject,
        pinnedProjectIds: [],
        emailNotifications,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(prefs._id, {
        emailNotifications,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const initializePreferences = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .unique();

    if (existing) {
      return { success: true, action: 'exists' };
    }

    await ctx.db.insert('userPreferences', {
      userId: identity.subject,
      pinnedProjectIds: [],
      updatedAt: Date.now(),
    });

    return { success: true, action: 'created' };
  },
});
