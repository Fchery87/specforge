"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Shield, 
  BarChart3, 
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AnalyticsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [timeRange, setTimeRange] = useState(30);
  
  // Get analytics data
  const analytics = useQuery(
    api.admin.getUsageAnalytics,
    isLoaded && isSignedIn ? { days: timeRange } : "skip"
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
          <p className="text-muted-foreground">Please sign in to access analytics</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (analytics === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading analytics data...</span>
        </div>
      </main>
    );
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format number
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Get provider icon color
  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      openai: 'bg-green-500/20 text-green-500',
      anthropic: 'bg-orange-500/20 text-orange-500',
      google: 'bg-blue-500/20 text-blue-500',
      mistral: 'bg-purple-500/20 text-purple-500',
      zai: 'bg-pink-500/20 text-pink-500',
      minimax: 'bg-cyan-500/20 text-cyan-500',
    };
    return colors[provider] || 'bg-muted text-muted-foreground';
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
              <BarChart3 className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Admin Console
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            Usage <span className="text-primary">Analytics</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Track token consumption, costs, and platform usage patterns.
          </p>
        </div>
      </section>

      {/* Time Range Selector */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Time Range:</span>
            <Select value={timeRange.toString()} onValueChange={(v) => setTimeRange(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </section>

      {/* Summary Stats */}
      <section className="page-section page-container">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatNumber(analytics.summary.totalTasks)}</p>
              <div className="flex items-center gap-2 mt-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Generation tasks</span>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn(
                "text-3xl font-bold",
                analytics.summary.successRate >= 90 ? "text-green-500" : 
                analytics.summary.successRate >= 70 ? "text-yellow-500" : "text-red-500"
              )}>
                {analytics.summary.successRate.toFixed(1)}%
              </p>
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {analytics.summary.completedTasks} completed
                </span>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatNumber(analytics.summary.totalTokens)}</p>
              <div className="flex items-center gap-2 mt-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Estimated consumption</span>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Est. Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{formatCurrency(analytics.summary.estimatedCost)}</p>
              <div className="flex items-center gap-2 mt-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Approximate spend</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Provider Usage */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Provider Usage
          </h2>
          <p className="text-muted-foreground mt-2">
            Token consumption and costs by LLM provider
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(analytics.providerUsage).map(([provider, data]: [string, any]) => (
            <Card key={provider} variant="default">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={cn("capitalize", getProviderColor(provider))}>
                    {provider}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {data.tasks} tasks
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Tokens</p>
                    <p className="text-2xl font-bold">{formatNumber(data.tokens)}</p>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">Est. Cost</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(data.cost)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {Object.keys(analytics.providerUsage).length === 0 && (
            <Card variant="default" className="md:col-span-2 lg:col-span-3 p-8 text-center">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No Usage Data</h3>
              <p className="text-muted-foreground">
                No generation tasks found in the selected time period.
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* Top Users */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Top Users
          </h2>
          <p className="text-muted-foreground mt-2">
            Most active users by task volume
          </p>
        </div>

        <Card variant="default">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <div className="grid grid-cols-12 gap-4 p-4 bg-secondary/30 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-5">User</div>
                <div className="col-span-3">Projects</div>
                <div className="col-span-3">Tasks</div>
              </div>

              {analytics.topUsers.length > 0 ? (
                analytics.topUsers.map((user: any, index: number) => (
                  <div 
                    key={user.userId}
                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/20"
                  >
                    <div className="col-span-1">
                      <span className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded text-sm font-bold",
                        index < 3 ? "bg-primary text-black" : "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </span>
                    </div>
                    <div className="col-span-5">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm truncate">
                          {user.userId.slice(0, 12)}...
                        </span>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="font-medium">{user.projects}</span>
                    </div>
                    <div className="col-span-3">
                      <span className="font-bold">{user.tasks}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">No user activity in this period</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Model Usage */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Model Usage
          </h2>
          <p className="text-muted-foreground mt-2">
            Token consumption by specific models
          </p>
        </div>

        <Card variant="default">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <div className="grid grid-cols-12 gap-4 p-4 bg-secondary/30 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-6">Model</div>
                <div className="col-span-3">Tokens</div>
                <div className="col-span-3">Tasks</div>
              </div>

              {Object.entries(analytics.modelUsage).length > 0 ? (
                Object.entries(analytics.modelUsage)
                  .sort(([, a]: [string, any], [, b]: [string, any]) => b.tokens - a.tokens)
                  .map(([modelId, data]: [string, any]) => (
                    <div 
                      key={modelId}
                      className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/20"
                    >
                      <div className="col-span-6">
                        <p className="font-medium truncate">{modelId}</p>
                      </div>
                      <div className="col-span-3">
                        <span className="font-medium">{formatNumber(data.tokens)}</span>
                      </div>
                      <div className="col-span-3">
                        <span className="font-medium">{data.tasks}</span>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="p-8 text-center">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">No model usage data</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        ANALYTICS
      </div>
    </main>
  );
}