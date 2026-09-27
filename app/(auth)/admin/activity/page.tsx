"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, 
  Shield, 
  Activity,
  ArrowLeft,
  Info,
  FileCode,
  Play,
  CheckCircle,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function ActivityMonitorPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  
  // Get role from Clerk's frontend API
  const userRole = user?.publicMetadata?.role as string | undefined;
  
  // Get recent activity
  const activities = useQuery(
    api.admin.getRecentActivity,
    isLoaded && isSignedIn ? { limit: 100 } : "skip"
  );

  // Show loading while Clerk auth is initializing
  if (!isLoaded) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  // Show message if not signed in
  if (!isSignedIn) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Please sign in to access the activity monitor</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (activities === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading activity data...</span>
        </div>
      </main>
    );
  }

  // Helper to get activity icon based on type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'generating':
        return <Play className="size-5 text-primary" />;
      case 'complete':
        return <CheckCircle className="size-5 text-success" />;
      case 'context':
        return <FileCode className="size-5 text-info" />;
      default:
        return <Info className="size-5 text-muted-foreground" />;
    }
  };

  // Helper to get activity color based on type
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'generating':
        return 'border-primary/50 bg-primary/5';
      case 'complete':
        return 'border-success/50 bg-success/5';
      case 'context':
        return 'border-info/50 bg-info/5';
      default:
        return 'border-line bg-void';
    }
  };

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Group activities by date
  const groupedActivities = activities.reduce<Record<string, typeof activities>>((groups, activity) => {
    const date = new Date(activity.timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {});

  // Get activity statistics
  const stats = {
    total: activities.length,
    generating: activities.filter((a) => a.type === 'generating').length,
    complete: activities.filter((a) => a.type === 'complete').length,
    info: activities.filter((a) => a.type === 'info').length,
    inProgress: activities.filter((a) => a.taskStatus === 'in_progress').length,
    failed: activities.filter((a) => a.taskStatus === 'failed').length,
  };

  return (
    <main>
      {/* Hero Header */}
      <section className="page-header">
        <div className="page-container">
          <span className="text-label text-dim">Admin Console</span>
          <h1 className="mt-2 text-heading font-medium text-ink">Activity Monitor</h1>
          <p className="mt-3 max-w-xl text-body leading-relaxed text-muted-foreground">Real-time monitoring of generation tasks, system events, and user activity.</p>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="page-section page-container">
        <div className="grid gap-4 md:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Total Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{stats.total}</p>
              <p className="text-caption text-muted-foreground mt-1">Last 100 events</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold text-warning">{stats.inProgress}</p>
              <div className="flex items-center gap-2 mt-1">
                <RefreshCw className="size-3 text-warning animate-spin" />
                <p className="text-caption text-muted-foreground">Active tasks</p>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold text-success">{stats.complete}</p>
              <p className="text-caption text-muted-foreground mt-1">Successful generations</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold text-destructive">{stats.failed}</p>
              <div className="flex items-center gap-2 mt-1">
                {stats.failed > 0 && <AlertCircle className="size-3 text-destructive" />}
                <p className="text-caption text-muted-foreground">Require attention</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Activity Timeline */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-title font-bold">
              Activity Timeline
            </h2>
            <p className="text-muted-foreground mt-2">
              Detailed log of all generation activities
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        {Object.keys(groupedActivities).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(groupedActivities).map(([date, dayActivities]) => (
              <div key={date}>
                <h3 className="text-ui font-bold text-muted-foreground mb-4 sticky top-0 bg-void py-2 z-10">
                  {date}
                </h3>
                <div className="space-y-3">
                  {dayActivities.map((activity) => (
                    <Card
                      key={activity.id}
                      variant="default"
                      className={cn(
                        "border-l transition-colors",
                        getActivityColor(activity.type)
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 mt-1">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium leading-tight mb-1">
                              {activity.message}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
                              <span className="font-mono bg-raised px-2 py-0.5 rounded-sm">
                                {activity.projectId.slice(0, 8)}...
                              </span>
                              <span>Phase: {activity.phaseId}</span>
                              <span>•</span>
                              <span>{formatTimestamp(activity.timestamp)}</span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <span
                              className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-caption font-medium",
                                activity.taskStatus === 'completed'
                                  ? "bg-success/10 text-success border border-success/20"
                                  : activity.taskStatus === 'failed'
                                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                                  : "bg-warning/10 text-warning border border-warning/20"
                              )}
                            >
                              {activity.taskStatus}
                            </span>
                            <p className="text-caption text-muted-foreground mt-1">
                              {formatRelativeTime(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card variant="default" className="p-12 text-center">
            <Activity className="size-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-title font-medium mb-2">No Activity Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Activity logs will appear here when users start generating artifacts. 
              Check back later to monitor system usage.
            </p>
          </Card>
        )}
      </section>

    </main>
  );
}
