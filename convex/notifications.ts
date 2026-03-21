import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const listNotifications = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx: QueryCtx, args: {
    limit?: number;
    cursor?: string;
    unreadOnly?: boolean;
  }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { notifications: [], nextCursor: null };

    const limit = args.limit ?? 20;

    let notificationsQuery = ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject));

    if (args.unreadOnly) {
      notificationsQuery = ctx.db
        .query('notifications')
        .withIndex('by_user_read', (q) =>
          q.eq('userId', identity.subject).eq('read', false)
        );
    }

    let notifications = await notificationsQuery
      .order('desc')
      .take(limit + 1);

    if (notifications.length > limit) {
      notifications = notifications.slice(0, limit);
      return {
        notifications,
        nextCursor: notifications[notifications.length - 1]._id,
      };
    }

    return { notifications, nextCursor: null };
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { count: 0 };

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) =>
        q.eq('userId', identity.subject).eq('read', false)
      )
      .collect();

    return { count: unread.length };
  },
});

export const markAsRead = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx: MutationCtx, args: { notificationId: Id<'notifications'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    await ctx.db.patch(args.notificationId, {
      read: true,
      readAt: Date.now(),
    });

    return { success: true };
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const unread = await ctx.db
      .query('notifications')
      .withIndex('by_user_read', (q) =>
        q.eq('userId', identity.subject).eq('read', false)
      )
      .collect();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, {
        read: true,
        readAt: Date.now(),
      });
    }

    return { success: true, markedCount: unread.length };
  },
});

export const deleteNotification = mutation({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx: MutationCtx, args: { notificationId: Id<'notifications'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== identity.subject) {
      throw new Error('Forbidden');
    }

    await ctx.db.delete(args.notificationId);
    return { success: true };
  },
});

export const clearAllNotifications = mutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const notifications = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect();

    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    return { success: true, deletedCount: notifications.length };
  },
});

export const createNotification = mutation({
  args: {
    userId: v.string(),
    type: v.union(
      v.literal('generation_complete'),
      v.literal('generation_failed'),
      v.literal('drift_detected'),
      v.literal('phase_stale'),
      v.literal('verification_complete'),
      v.literal('system_announcement'),
    ),
    title: v.string(),
    message: v.string(),
    metadata: v.optional(v.object({
      projectId: v.optional(v.id('projects')),
      phaseId: v.optional(v.string()),
      artifactId: v.optional(v.id('artifacts')),
      actionUrl: v.optional(v.string()),
    })),
  },
  handler: async (ctx: MutationCtx, args: {
    userId: string;
    type: 'generation_complete' | 'generation_failed' | 'drift_detected' | 'phase_stale' | 'verification_complete' | 'system_announcement';
    title: string;
    message: string;
    metadata?: {
      projectId?: Id<'projects'>;
      phaseId?: string;
      artifactId?: Id<'artifacts'>;
      actionUrl?: string;
    };
  }) => {
    const id = await ctx.db.insert('notifications', {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      metadata: args.metadata,
      read: false,
      createdAt: Date.now(),
    });

    return { success: true, notificationId: id };
  },
});

export const getNotificationById = query({
  args: {
    notificationId: v.id('notifications'),
  },
  handler: async (ctx: QueryCtx, args: { notificationId: Id<'notifications'> }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== identity.subject) {
      return null;
    }

    return notification;
  },
});
