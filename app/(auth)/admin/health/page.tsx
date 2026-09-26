"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Shield, 
  Activity, 
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Server,
  Database,
  Zap,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  FolderOpen,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google", name: "Google" },
  { id: "mistral", name: "Mistral" },
  { id: "zai", name: "Z.AI" },
  { id: "minimax", name: "Minimax" },
];

export default function HealthMonitorPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [checking, setChecking] = useState<Set<string>>(new Set());
  
  // Get health status
  const health = useQuery(
    api.admin.getHealthStatus,
    isLoaded && isSignedIn ? {} : "skip"
  );

  // Health check mutation
  const checkProvider = useMutation(api.admin.checkProviderHealth);

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
          <p className="text-muted-foreground">Please sign in to access health monitor</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (health === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading health data...</span>
        </div>
      </main>
    );
  }

  // Handle health check
  const handleCheck = async (provider: string) => {
    setChecking(prev => new Set(prev).add(provider));
    try {
      await checkProvider({ provider });
    } catch (err) {
      console.error(`Failed to check ${provider}:`, err);
    } finally {
      setChecking(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="size-5 text-sage" />;
      case 'degraded':
        return <AlertTriangle className="size-5 text-amber" />;
      case 'down':
        return <XCircle className="size-5 text-brick" />;
      default:
        return <Activity className="size-5 text-muted-foreground" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-sage/10 text-sage border-sage/50';
      case 'degraded':
        return 'bg-amber/10 text-amber border-amber/50';
      case 'down':
        return 'bg-brick/10 text-brick border-brick/50';
      default:
        return 'bg-raised text-muted-foreground border-line';
    }
  };

  // Format time
  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <main>
      {/* Hero Header */}
      <section className="page-header">
        <div className="page-container">
          <span className="text-label text-dim">Admin Console</span>
          <h1 className="mt-2 text-heading font-medium text-ink">System Health Monitor</h1>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-muted-foreground">Monitor LLM provider health, queue status, and system performance.</p>
        </div>
      </section>

      {/* Overall Status */}
      <section className="page-section page-container border-t border-line">
        <div className="grid gap-4 md:grid-cols-4">
          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "size-3 rounded-full",
                  health.errorRate.percentage < 5 ? "bg-sage" : 
                  health.errorRate.percentage < 15 ? "bg-amber" : "bg-brick"
                )} />
                <span className="text-title font-bold">
                  {health.errorRate.percentage < 5 ? 'Healthy' : 
                   health.errorRate.percentage < 15 ? 'Degraded' : 'Critical'}
                </span>
              </div>
              <p className="text-caption text-muted-foreground mt-2">Based on error rate</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Error Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn(
                "text-heading font-bold",
                health.errorRate.percentage < 5 ? "text-sage" : 
                health.errorRate.percentage < 15 ? "text-amber" : "text-brick"
              )}>
                {health.errorRate.percentage.toFixed(1)}%
              </p>
              <p className="text-caption text-muted-foreground mt-2">
                {health.errorRate.recentFailed} / {health.errorRate.recentTotal} tasks
              </p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Active Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{health.queue.inProgress}</p>
              <div className="flex items-center gap-2 mt-2">
                <Clock className="size-4 text-amber animate-pulse" />
                <span className="text-caption text-muted-foreground">In progress</span>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader className="pb-3">
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Storage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{formatNumber(health.storage.projects)}</p>
              <div className="flex items-center gap-2 mt-2">
                <Database className="size-4 text-muted-foreground" />
                <span className="text-caption text-muted-foreground">Projects stored</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Provider Health Status */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-title font-bold">
              Provider Health
            </h2>
            <p className="text-muted-foreground mt-2">
              Real-time status of LLM provider endpoints
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((provider) => {
            const healthData = health.providers.find((p) => p.provider === provider.id);
            const isChecking = checking.has(provider.id);
            
            return (
              <Card 
                key={provider.id} 
                variant="default"
                className={cn(
                  "transition-colors",
                  !healthData && "opacity-60"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Server className="size-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-body">{provider.name}</CardTitle>
                        <CardDescription className="text-caption">
                          {healthData ? formatTime(healthData.lastChecked) : 'Not checked'}
                        </CardDescription>
                      </div>
                    </div>
                    
                    {healthData ? (
                      <Badge 
                        variant="outline" 
                        className={cn("capitalize", getStatusColor(healthData.status))}
                      >
                        {healthData.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unknown</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-raised/30 rounded-lg">
                        <p className="text-caption text-muted-foreground">Response Time</p>
                        <p className="text-title font-bold">
                          {healthData ? `${Math.round(healthData.responseTime)}ms` : '--'}
                        </p>
                      </div>
                      
                      <div className="p-3 bg-raised/30 rounded-lg">
                        <p className="text-caption text-muted-foreground">Failures</p>
                        <p className={cn(
                          "text-title font-bold",
                          healthData && healthData.consecutiveFailures > 0 ? "text-brick" : ""
                        )}>
                          {healthData ? healthData.consecutiveFailures : '--'}
                        </p>
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleCheck(provider.id)}
                      disabled={isChecking}
                    >
                      {isChecking ? (
                        <>
                          <RefreshCw className="size-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Activity className="size-4 mr-2" />
                          Check Health
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Queue Status */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8">
          <h2 className="text-title font-bold">
            Generation Queue
          </h2>
          <p className="text-muted-foreground mt-2">
            Current task processing status
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default" className="border-amber/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="size-5 text-amber" />
                <CardTitle>In Progress</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold text-amber">{health.queue.inProgress}</p>
              <p className="text-ui text-muted-foreground mt-2">Tasks being processed</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Layers className="size-5 text-muted-foreground" />
                <CardTitle>Queued</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{health.queue.queued}</p>
              <p className="text-ui text-muted-foreground mt-2">Waiting to start</p>
            </CardContent>
          </Card>

          <Card variant="default" className="border-brick/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <XCircle className="size-5 text-brick" />
                <CardTitle>Failed</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold text-brick">{health.queue.failed}</p>
              <p className="text-ui text-muted-foreground mt-2">Require attention</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Storage Stats */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8">
          <h2 className="text-title font-bold">
            Storage Overview
          </h2>
          <p className="text-muted-foreground mt-2">
            Database storage metrics
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card variant="default">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-ui text-muted-foreground">Projects</p>
                  <p className="text-title font-bold">{formatNumber(health.storage.projects)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-ui text-muted-foreground">Artifacts</p>
                  <p className="text-title font-bold">{formatNumber(health.storage.artifacts)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-ui text-muted-foreground">Est. Tokens</p>
                  <p className="text-title font-bold">{formatNumber(Math.round(health.storage.estimatedTokens))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

    </main>
  );
}

// Format number helper
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}