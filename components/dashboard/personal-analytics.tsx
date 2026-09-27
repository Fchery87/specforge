'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  TrendingUp, 
  Clock, 
  Coins,
  Activity,
  Sparkles
} from 'lucide-react';

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  accent = false,
  trend = null as 'up' | 'down' | null
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  trend?: 'up' | 'down' | null;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        accent ? "border-brand/50 bg-brand/5" : "border-line/50"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <span className="text-caption text-dim">{title}</span>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-sm",
            accent ? "bg-brand text-primary-foreground" : "bg-raised/50 text-dim"
          )}
        >
          <Icon className="size-4" />
        </div>
      </CardHeader>

      <CardContent>
        <div className={cn("text-heading font-semibold text-ink", accent && "text-brand")}>
          {value}
        </div>

        <div className="mt-2 flex items-center justify-between">
          {subtitle && <span className="text-caption text-muted-foreground">{subtitle}</span>}

          {trend && (
            <span
              className={cn(
                "text-caption",
                trend === "up" ? "text-success" : "text-destructive"
              )}
            >
              {trend === "up" ? "Trending up" : "Trending down"}
            </span>
          )}
        </div>
      </CardContent>

      {accent && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-brand/30" />
      )}
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-line/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-8" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-2 h-8 w-24" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

export function PersonalAnalytics() {
  const stats = useQuery(api.userDashboard.getUserStats, { period: '30d' });

  if (stats === undefined) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const successTrend = stats.successRate >= 90 ? 'up' : stats.successRate >= 70 ? null : 'down';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Activity className="size-5 text-brand" />
          <div className="absolute -top-1 -right-1 size-2 animate-pulse rounded-full bg-brand" />
        </div>
        <h2 className="text-ui font-medium text-ink">Your stats</h2>
        <span className="bg-raised/50 px-2 py-0.5 text-caption text-dim">30 days</span>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Specs Generated"
          value={formatNumber(stats.specsGenerated)}
          subtitle={`${stats.projectCount} total projects`}
          icon={FileText}
          accent
        />
        
        <StatCard
          title="Success Rate"
          value={`${stats.successRate}%`}
          subtitle="Generation success"
          icon={TrendingUp}
          trend={successTrend}
        />
        
        <StatCard
          title="Time Saved"
          value={`${Math.round(stats.timeSavedMinutes / 60)}h`}
          subtitle={`${stats.timeSavedMinutes} minutes`}
          icon={Clock}
        />
        
        <StatCard
          title="Est. Cost"
          value={formatCurrency(stats.estimatedCost)}
          subtitle={`${formatNumber(stats.tokensUsed)} tokens`}
          icon={Coins}
        />
      </div>
      
      <div className="flex items-center gap-6 pt-2 text-caption text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3" />
          <span>{stats.phasesCompleted} phases completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-success" />
          <span>{stats.activeProjects} active projects</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-brand" />
          <span>{stats.completedProjects} completed</span>
        </div>
      </div>
    </div>
  );
}
