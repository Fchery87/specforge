'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
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
import { cn } from '@/lib/utils';
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
  generation_complete: 'text-emerald-500 bg-emerald-500/10',
  generation_failed: 'text-red-500 bg-red-500/10',
  drift_detected: 'text-orange-500 bg-orange-500/10',
  phase_stale: 'text-amber-500 bg-amber-500/10',
  verification_complete: 'text-emerald-500 bg-emerald-500/10',
  system_announcement: 'text-blue-500 bg-blue-500/10',
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

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
  const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-muted-foreground bg-muted';

  return (
    <div
      className={cn(
        'flex gap-3 p-3 hover:bg-muted/30 transition-colors group relative',
        !notification.read && 'bg-primary/5'
      )}
    >
      {!notification.read && (
        <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-primary" />
      )}

      <div className={cn('w-8 h-8 rounded-none flex items-center justify-center shrink-0 mt-0.5', colorClass)}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{notification.title}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelativeTime(notification.createdAt)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>

        <div className="flex items-center gap-2 mt-2">
          {notification.metadata?.actionUrl && (
            <Link
              href={notification.metadata.actionUrl as Route}
              className="text-xs font-medium text-primary hover:underline"
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
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark read
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-3 h-3" />
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
          <Skeleton className="w-8 h-8 rounded-none" />
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

  async function handleMarkAsRead(notificationId: string) {
    try {
      await markAsRead({ notificationId: notificationId as any });
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

  async function handleDelete(notificationId: string) {
    try {
      await deleteNotification({ notificationId: notificationId as any });
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
          className="relative hover:bg-muted/50"
        >
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-none bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-bold uppercase tracking-wider text-sm">Notifications</h4>
            {count > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5">
                {count}
              </Badge>
            )}
          </div>

          {count > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {recentNotifications === undefined ? (
            <NotificationSkeleton />
          ) : recentNotifications.notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-none bg-muted/50 flex items-center justify-center">
                <Bell className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You&apos;ll be notified when something happens
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentNotifications.notifications.map((notification: Notification) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onMarkAsRead={() => handleMarkAsRead(notification._id)}
                  onDelete={() => handleDelete(notification._id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-2 border-t">
          <Link
            href={'/notifications' as Route}
            className="block text-center text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
