'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Shield,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTIVITY_ICONS = {
  project_created: FileText,
  phase_started: Play,
  phase_completed: CheckCircle,
  generation_started: Loader2,
  generation_completed: CheckCircle,
  generation_failed: XCircle,
  drift_detected: AlertTriangle,
  verification_complete: Shield,
  project_updated: RefreshCw,
};

const ACTIVITY_COLORS: Record<string, string> = {
  project_created: 'text-blue-500 bg-blue-500/10',
  phase_started: 'text-amber-500 bg-amber-500/10',
  phase_completed: 'text-emerald-500 bg-emerald-500/10',
  generation_started: 'text-primary bg-primary/10',
  generation_completed: 'text-emerald-500 bg-emerald-500/10',
  generation_failed: 'text-red-500 bg-red-500/10',
  drift_detected: 'text-orange-500 bg-orange-500/10',
  verification_complete: 'text-emerald-500 bg-emerald-500/10',
  project_updated: 'text-blue-500 bg-blue-500/10',
};

const ACTIVITY_LABELS: Record<string, string> = {
  project_created: 'Created',
  phase_started: 'Started',
  phase_completed: 'Completed',
  generation_started: 'Generating',
  generation_completed: 'Generated',
  generation_failed: 'Failed',
  drift_detected: 'Drift',
  verification_complete: 'Verified',
  project_updated: 'Updated',
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return 'now';
}

function groupByTime(activities: { _id: string; createdAt: number; type: string; message: string; metadata?: Record<string, unknown> }[]): [string, typeof activities][] {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const groups: Record<string, typeof activities> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  for (const activity of activities) {
    const age = now - activity.createdAt;
    let group = 'Older';

    if (age < oneDay) group = 'Today';
    else if (age < 2 * oneDay) group = 'Yesterday';
    else if (age < 7 * oneDay) group = 'This Week';

    groups[group].push(activity);
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0) as [string, Activity[]][];
}

interface Activity {
  _id: string;
  type: keyof typeof ACTIVITY_ICONS;
  message: string;
  metadata?: {
    phaseName?: string;
    artifactType?: string;
    success?: boolean;
    errorMessage?: string;
  };
  createdAt: number;
}

function ActivityItem({ activity }: { activity: Activity }) {
  const Icon = ACTIVITY_ICONS[activity.type];
  const colorClass = ACTIVITY_COLORS[activity.type] || 'text-muted-foreground bg-muted';
  const label = ACTIVITY_LABELS[activity.type] || activity.type;

  return (
    <div className="flex gap-3 p-3 hover:bg-muted/30 transition-colors group">
      <div className={cn('w-8 h-8 rounded-none flex items-center justify-center shrink-0', colorClass)}>
        <Icon className={cn('w-4 h-4', activity.type === 'generation_started' && 'animate-spin')} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(activity.createdAt)}
          </span>
        </div>

        <p className="text-sm font-medium leading-tight mt-0.5 group-hover:text-foreground transition-colors">
          {activity.message}
        </p>

        {activity.metadata?.phaseName && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {activity.metadata.phaseName}
          </p>
        )}

        {activity.metadata?.errorMessage && (
          <p className="text-xs text-red-500 mt-1 truncate">
            {activity.metadata.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3">
          <Skeleton className="w-8 h-8 rounded-none" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeed() {
  const feed = useQuery(api.userDashboard.getActivityFeed, { limit: 20 });

  if (feed === undefined) {
    return (
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold uppercase tracking-wider">
              Recent Activity
            </CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 px-4">
          <ActivityFeedSkeleton />
        </CardContent>
      </Card>
    );
  }

  const { activities } = feed;
  const grouped = groupByTime((activities ?? []) as Activity[]);

  if (activities.length === 0) {
    return (
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold uppercase tracking-wider">
              Recent Activity
            </CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-none bg-muted/50 flex items-center justify-center">
              <Clock className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your project activity will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold uppercase tracking-wider">
            Recent Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-4">
          <div className="space-y-6 pb-4">
            {grouped.map(([timeGroup, items]) => (
              <div key={timeGroup}>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur py-1">
                  {timeGroup}
                </h4>
                <div className="space-y-1">
                  {(items as Activity[]).map((activity) => (
                    <ActivityItem key={activity._id} activity={activity} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
