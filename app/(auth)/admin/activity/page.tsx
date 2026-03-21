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
import { cn } from "@/lib/utils";
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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading activity data...</span>
        </div>
      </main>
    );
  }

  // Helper to get activity icon based on type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'generating':
        return <Play className="w-5 h-5 text-primary" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'context':
        return <FileCode className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-muted-foreground" />;
    }
  };

  // Helper to get activity color based on type
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'generating':
        return 'border-primary/50 bg-primary/5';
      case 'complete':
        return 'border-green-500/50 bg-green-500/5';
      case 'context':
        return 'border-blue-500/50 bg-blue-500/5';
      default:
        return 'border-border bg-background';
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

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Group activities by date
  const groupedActivities = activities.reduce((groups: any, activity: any) => {
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
    generating: activities.filter((a: any) => a.type === 'generating').length,
    complete: activities.filter((a: any) => a.type === 'complete').length,
    info: activities.filter((a: any) => a.type === 'info').length,
    inProgress: activities.filter((a: any) => a.taskStatus === 'in_progress').length,
    failed: activities.filter((a: any) => a.taskStatus === 'failed').length,
  };

  return (
    <main className="relative">
      {/* Hero Header */}
      <section className="page-header relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-fade opacity-20" />
        <div className="page-container relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Admin Console
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            Activity <span className="text-primary">Monitor</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Real-time monitoring of generation tasks, system events, and user activity.
          </p>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="page-section page-container">
        <div className="grid gap-4 md:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Last 100 events</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-500">{stats.inProgress}</p>
              <div className="flex items-center gap-2 mt-1">
                <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin" />
                <p className="text-xs text-muted-foreground">Active tasks</p>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-500">{stats.complete}</p>
              <p className="text-xs text-muted-foreground mt-1">Successful generations</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-500">{stats.failed}</p>
              <div className="flex items-center gap-2 mt-1">
                {stats.failed > 0 && <AlertCircle className="w-3 h-3 text-red-500" />}
                <p className="text-xs text-muted-foreground">Require attention</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Activity Timeline */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
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
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {Object.keys(groupedActivities).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(groupedActivities).map(([date, dayActivities]: [string, any]) => (
              <div key={date}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 sticky top-0 bg-background py-2 z-10">
                  {date}
                </h3>
                <div className="space-y-3">
                  {dayActivities.map((activity: any) => (
                    <Card
                      key={activity.id}
                      variant="default"
                      className={cn(
                        "border-l-4 transition-all hover:shadow-md",
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
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-mono bg-secondary px-2 py-0.5 rounded">
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
                                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                                activity.taskStatus === 'completed'
                                  ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                  : activity.taskStatus === 'failed'
                                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                  : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                              )}
                            >
                              {activity.taskStatus}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
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
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">No Activity Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Activity logs will appear here when users start generating artifacts. 
              Check back later to monitor system usage.
            </p>
          </Card>
        )}
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        ACTIVITY
      </div>
    </main>
  );
}
