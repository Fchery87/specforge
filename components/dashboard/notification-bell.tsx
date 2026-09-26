'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  FileText,
  AlertTriangle,
  Shield,
  Info,
  X,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import type { Route } from 'next';
import { toast } from 'sonner';

const NOTIFICATION_ICONS = {
  generation_complete: FileText,
  generation_failed: AlertTriangle,
  drift_detected: AlertTriangle,
  phase_stale: AlertTriangle,
  verification_complete: Shield,
  system_announcement: Info,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  generation_complete: 'text-sage bg-sage/10',
  generation_failed: 'text-brick bg-brick/10',
  drift_detected: 'text-amber bg-amber/10',
  phase_stale: 'text-amber bg-amber/10',
  verification_complete: 'text-sage bg-sage/10',
  system_announcement: 'text-slate bg-slate/10',
};

interface Notification {
  _id: string;
  type: keyof typeof NOTIFICATION_ICONS;
  title: string;
  message: string;
  read: boolean;
  metadata?: {
    projectId?: string;
    phaseId?: string;
    artifactId?: string;
    actionUrl?: string;
  };
  createdAt: number;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
}) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Info;
  const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-muted-foreground bg-raised';

  return (
    <div
      className={cn(
        'flex gap-3 p-3 hover:bg-raised/30 transition-colors group relative',
        !notification.read && 'bg-primary/5'
      )}
    >
      {!notification.read && (
        <div className="absolute top-3 left-3 size-2 rounded-full bg-primary" />
      )}

      <div className={cn('size-8 rounded-sm flex items-center justify-center shrink-0 mt-0.5', colorClass)}>
        <Icon className="size-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-ui font-medium leading-tight">{notification.title}</p>
          <span className="text-caption text-muted-foreground shrink-0">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>

        <p className="text-caption text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>

        <div className="flex items-center gap-2 mt-2">
          {notification.metadata?.actionUrl && (
            <Link
              href={notification.metadata.actionUrl as Route}
              className="text-caption font-medium text-primary hover:underline"
            >
              View
            </Link>
          )}

          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
              className="text-caption text-muted-foreground hover:text-ink transition-colors"
            >
              Mark read
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-caption text-muted-foreground hover:text-destructive transition-colors ml-auto opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 rounded-sm" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const recentNotifications = useQuery(api.notifications.listNotifications, { limit: 10 });

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const deleteNotification = useMutation(api.notifications.deleteNotification);

  const count = unreadCount?.count ?? 0;

  async function handleMarkAsRead(notificationId: Id<'notifications'>) {
    try {
      await markAsRead({ notificationId });
    } catch {
      toast.error('Failed to mark notification as read');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllAsRead({});
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  }

  async function handleDelete(notificationId: Id<'notifications'>) {
    try {
      await deleteNotification({ notificationId });
      toast.success('Notification deleted');
    } catch {
      toast.error('Failed to delete notification');
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-raised/50"
        >
          <Bell className="size-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-caption font-bold flex items-center justify-center px-1">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-ui">Notifications</h4>
            {count > 0 && (
              <Badge variant="destructive" className="text-caption px-1.5">
                {count}
              </Badge>
            )}
          </div>

          {count > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-caption text-muted-foreground hover:text-ink transition-colors flex items-center gap-1"
            >
              <CheckCheck className="size-3" />
              Mark all read
            </button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {recentNotifications === undefined ? (
            <NotificationSkeleton />
          ) : recentNotifications.notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="size-12 mx-auto mb-3 rounded-sm bg-raised/50 flex items-center justify-center">
                <Bell className="size-6 text-muted-foreground" />
              </div>
              <p className="text-ui text-muted-foreground">No notifications</p>
              <p className="text-caption text-muted-foreground mt-1">
                You&apos;ll be notified when something happens
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {recentNotifications.notifications.map((notification: Notification) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onMarkAsRead={() => handleMarkAsRead(notification._id as Id<'notifications'>)}
                  onDelete={() => handleDelete(notification._id as Id<'notifications'>)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Link
            href={'/notifications' as Route}
            className="block text-center text-caption text-muted-foreground hover:text-ink py-2 transition-colors"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
