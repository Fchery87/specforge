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
import { cn, formatRelativeTime } from '@/lib/utils';

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
  project_created: 'text-info bg-info/10',
  phase_started: 'text-warning bg-warning/10',
  phase_completed: 'text-success bg-success/10',
  generation_started: 'text-primary bg-primary/10',
  generation_completed: 'text-success bg-success/10',
  generation_failed: 'text-destructive bg-destructive/10',
  drift_detected: 'text-warning bg-warning/10',
  verification_complete: 'text-success bg-success/10',
  project_updated: 'text-info bg-info/10',
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
  const colorClass = ACTIVITY_COLORS[activity.type] || 'text-muted-foreground bg-raised';
  const label = ACTIVITY_LABELS[activity.type] || activity.type;

  return (
    <div className="flex gap-3 p-3 hover:bg-raised/30 transition-colors group">
      <div className={cn('size-8 rounded-sm flex items-center justify-center shrink-0', colorClass)}>
        <Icon className={cn('size-4', activity.type === 'generation_started' && 'animate-spin')} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-caption font-semibold text-muted-foreground">
            {label}
          </span>
          <span className="text-caption text-muted-foreground">
            {formatRelativeTime(activity.createdAt)}
          </span>
        </div>

        <p className="text-ui font-medium leading-tight mt-0.5 group-hover:text-ink transition-colors">
          {activity.message}
        </p>

        {activity.metadata?.phaseName && (
          <p className="text-caption text-muted-foreground mt-0.5">
            {activity.metadata.phaseName}
          </p>
        )}

        {activity.metadata?.errorMessage && (
          <p className="text-caption text-destructive mt-1 truncate">
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
          <Skeleton className="size-8 rounded-sm" />
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
            <CardTitle className="text-title font-semibold">
              Recent Activity
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
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
            <CardTitle className="text-title font-semibold">
              Recent Activity
            </CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="size-12 mx-auto mb-3 rounded-sm bg-raised/50 flex items-center justify-center">
              <Clock className="size-6 text-muted-foreground" />
            </div>
            <p className="text-ui text-muted-foreground">No activity yet</p>
            <p className="text-caption text-muted-foreground mt-1">
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
          <CardTitle className="text-title font-semibold">
            Recent Activity
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-success animate-pulse" />
            <span className="text-caption text-muted-foreground">Live</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-4">
          <div className="space-y-6 pb-4">
            {grouped.map(([timeGroup, items]) => (
              <div key={timeGroup}>
                <h4 className="text-caption font-semibold text-muted-foreground mb-3 sticky top-0 bg-void/80 py-1">
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
