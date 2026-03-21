'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
      className={`
        relative overflow-hidden transition-all duration-300
        hover:shadow-lg hover:-translate-y-0.5
        ${accent ? 'border-primary/50 bg-primary/5' : 'border-border/50'}
      `}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 opacity-0 hover:opacity-100 transition-opacity" />
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </span>
        <div className={`
          w-8 h-8 rounded-none flex items-center justify-center
          ${accent ? 'bg-primary text-black' : 'bg-secondary/50 text-muted-foreground'}
          transition-transform group-hover:scale-110
        `}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10">
        <div className={`text-3xl font-black tracking-tight ${accent ? 'text-primary' : ''}`}>
          {value}
        </div>
        
        <div className="flex items-center justify-between mt-2">
          {subtitle && (
            <span className="text-[11px] text-muted-foreground tracking-wide">
              {subtitle}
            </span>
          )}
          
          {trend && (
            <span className={`
              text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5
              ${trend === 'up' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}
            `}>
              {trend === 'up' ? '↑' : '↓'} trending
            </span>
          )}
        </div>
      </CardContent>
      
      {accent && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20" />
      )}
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="w-8 h-8" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-24 mb-2" />
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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Activity className="w-5 h-5 text-primary" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Your Stats
        </h2>
        <span className="text-[10px] px-2 py-0.5 bg-secondary/50 text-muted-foreground">
          30 days
        </span>
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
      
      <div className="flex items-center gap-6 pt-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          <span>{stats.phasesCompleted} phases completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{stats.activeProjects} active projects</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>{stats.completedProjects} completed</span>
        </div>
      </div>
    </div>
  );
}
