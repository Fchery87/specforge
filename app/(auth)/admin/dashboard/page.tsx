"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Loader2, 
  Shield, 
  FolderOpen, 
  FileText, 
  Users, 
  Sparkles, 
  Key, 
  ArrowRight,
  CheckCircle2,
  XCircle,
  Activity,
  Info,
  FileCode,
  Play,
  CheckCircle,
  BarChart3,
  Lock,
  Settings,
  Flag
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", short: "GPT" },
  { id: "anthropic", name: "Anthropic", short: "Claude" },
  { id: "mistral", name: "Mistral", short: "Mistral" },
  { id: "zai", name: "Z.AI", short: "GLM" },
  { id: "minimax", name: "Minimax", short: "MM" },
];

export default function AdminDashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  
  // Get role from Clerk's frontend API
  const userRole = user?.publicMetadata?.role as string | undefined;
  
  // Get stats - backend now reads admin role from JWT
  const stats = useQuery(
    api.admin.getSystemStats,
    isLoaded && isSignedIn ? {} : "skip"
  );

  // Get system credentials status
  const systemCredentials = useQuery(
    api.admin.listSystemCredentials,
    isLoaded && isSignedIn ? {} : "skip"
  );

  // Get models count
  const models = useQuery(
    api.admin.listAllModels,
    isLoaded && isSignedIn ? {} : "skip"
  );

  // Get recent activity
  const activities = useQuery(
    api.admin.getRecentActivity,
    isLoaded && isSignedIn ? { limit: 20 } : "skip"
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
          <p className="text-muted-foreground">Please sign in to access the admin dashboard</p>
        </div>
      </main>
    );
  }

  // Show loading while data is being fetched
  if (stats === undefined || systemCredentials === undefined || models === undefined || activities === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading admin data...</span>
        </div>
      </main>
    );
  }

  // Helper to check credential status
  const getCredentialStatus = (providerId: string) => {
    const cred = systemCredentials?.find((c) => c.provider === providerId);
    if (!cred) return { configured: false, enabled: false };
    return {
      configured: !!cred.apiKey,
      enabled: cred.isEnabled,
    };
  };

  const enabledModelsCount = models?.filter((m) => m.enabled).length || 0;
  const configuredProviders = PROVIDERS.filter(p => getCredentialStatus(p.id).configured).length;

  // Helper to get activity icon based on type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'generating':
        return <Play className="size-4 text-primary" />;
      case 'complete':
        return <CheckCircle className="size-4 text-success" />;
      case 'context':
        return <FileCode className="size-4 text-info" />;
      default:
        return <Info className="size-4 text-muted-foreground" />;
    }
  };

  return (
    <main>
      {/* Hero header */}
      <section className="page-header">
        <div className="page-container">
          <span className="text-label text-dim">Admin Console</span>
          <h1 className="mt-2 text-heading font-medium text-ink">System Control</h1>
          <p className="mt-3 max-w-xl text-body leading-relaxed text-muted-foreground">Inspect system metrics, manage global LLM providers, and audit generation activity.</p>
        </div>
      </section>

      {/* Stats Grid Section */}
      <section className="page-section page-container">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Projects */}
          <Card variant="default">
            <CardHeader>
              <div className="size-14 border border-primary bg-primary/10 flex items-center justify-center mb-4">
                <FolderOpen className="size-7 text-primary" />
              </div>
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Total Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{stats.totalProjects}</p>
              <div className="flex gap-4 mt-2 text-ui text-muted-foreground">
                <span>{stats.projectsByStatus.active} active</span>
                <span>{stats.projectsByStatus.complete} complete</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Artifacts */}
          <Card variant="default">
            <CardHeader>
              <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4">
                <FileText className="size-7 text-muted-foreground" />
              </div>
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Total Artifacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{stats.totalArtifacts}</p>
              <p className="mt-2 text-ui text-muted-foreground">Generated documents</p>
            </CardContent>
          </Card>

          {/* Users with Config */}
          <Card variant="default">
            <CardHeader>
              <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4">
                <Users className="size-7 text-muted-foreground" />
              </div>
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Users Configured
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{stats.totalUsersWithConfig}</p>
              <p className="mt-2 text-ui text-muted-foreground">With LLM settings</p>
            </CardContent>
          </Card>

          {/* Models Enabled */}
          <Card variant="default">
            <CardHeader>
              <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4">
                <Sparkles className="size-7 text-muted-foreground" />
              </div>
              <CardTitle className="text-ui text-muted-foreground font-medium">
                Models Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-heading font-bold">{enabledModelsCount}</p>
              <p className="mt-2 text-ui text-muted-foreground">of {models?.length || 0} configured</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Provider Status Section */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8">
          <h2 className="text-title font-bold">
            Provider Status
          </h2>
          <p className="text-muted-foreground mt-2">
            System-wide LLM provider credentials ({configuredProviders}/{PROVIDERS.length} configured)
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {PROVIDERS.map((provider) => {
            const status = getCredentialStatus(provider.id);
            const isActive = status.configured && status.enabled;
            
            return (
              <div
                key={provider.id}
                className={cn(
                  "p-4 border transition-colors",
                  isActive 
                    ? "border-primary/50 bg-primary/5" 
                    : status.configured 
                      ? "border-line bg-raised/20 opacity-60"
                      : "border-line/50 bg-void opacity-40"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Key className={cn(
                    "size-5",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  {isActive ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : status.configured ? (
                    <XCircle className="size-4 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="font-bold text-ui">
                  {provider.short}
                </p>
                <p className="text-caption text-muted-foreground mt-1">
                  {isActive ? "Active" : status.configured ? "Disabled" : "Not Set"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Navigation Section */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8">
          <h2 className="text-title font-bold">
            Quick Actions
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* User Management */}
          <Link href={"/admin/users" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <Users className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  View users, manage roles, and audit user activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  Manage Users <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Project Management */}
          <Link href={"/admin/projects" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <FolderOpen className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>Project Control Center</CardTitle>
                <CardDescription>
                  Cross-user project visibility, bulk operations, and moderation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  Manage Projects <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Analytics */}
          <Link href={"/admin/analytics" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <BarChart3 className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>Usage Analytics</CardTitle>
                <CardDescription>
                  Token consumption, cost tracking, and usage patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  View Analytics <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* System Health */}
          <Link href={"/admin/health" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <Activity className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>System Health</CardTitle>
                <CardDescription>
                  Monitor LLM provider health, queue status, and performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  Monitor Health <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Security & Audit */}
          <Link href={"/admin/security" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <Lock className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>Security & Audit</CardTitle>
                <CardDescription>
                  Security events, audit trails, and administrative actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  View Logs <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Settings */}
          <Link href={"/admin/settings" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <Settings className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>
                  Feature flags, rate limits, and system-wide configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  Configure <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Content Moderation */}
          <Link href={"/admin/moderation" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <Flag className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>Content Moderation</CardTitle>
                <CardDescription>
                  Review artifacts, templates, and content filtering
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  Moderate <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* LLM Models & System Credentials */}
          <Link href={"/admin/llm-models" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <Sparkles className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>LLM Models & Credentials</CardTitle>
                <CardDescription>
                  Configure active models, token limits, and system-wide API keys
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  Manage AI Infrastructure <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Activity Monitor */}
          <Link href={"/admin/activity" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary transition-colors">
                  <Activity className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>Activity Monitor</CardTitle>
                <CardDescription>
                  View recent generation activity and system logs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold transition-colors">
                  View Activity <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Activity Feed */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8">
          <h2 className="text-title font-bold">
            Recent Activity
          </h2>
          <p className="text-muted-foreground mt-2">
            Latest generation tasks and system events
          </p>
        </div>

        <Card variant="default">
          <CardContent className="p-0">
            {activities && activities.length > 0 ? (
              <div className="divide-y divide-line">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 hover:bg-raised/30 transition-colors"
                  >
                    <div className="mt-1 flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ui font-medium leading-none mb-1">
                        {activity.message}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        Project: {activity.projectId} • Phase: {activity.phaseId}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-caption text-muted-foreground">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-sm text-caption font-medium mt-1",
                          activity.taskStatus === 'completed'
                            ? "bg-success/10 text-success"
                            : activity.taskStatus === 'failed'
                            ? "bg-destructive/10 text-destructive"
                            : "bg-warning/10 text-warning"
                        )}
                      >
                        {activity.taskStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Activity className="size-8 mx-auto mb-3 opacity-50" />
                <p className="text-ui">No recent activity</p>
                <p className="text-caption mt-1">Activity will appear here when users generate artifacts</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Projects Breakdown */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8">
          <h2 className="text-title font-bold">
            Project Breakdown
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-6 border border-line bg-void">
            <p className="text-ui text-muted-foreground mb-2">Draft</p>
            <p className="text-heading font-bold">{stats.projectsByStatus.draft}</p>
          </div>
          <div className="p-6 border border-primary/50 bg-primary/5">
            <p className="text-ui text-primary mb-2">Active</p>
            <p className="text-heading font-bold text-primary">{stats.projectsByStatus.active}</p>
          </div>
          <div className="p-6 border border-line bg-void">
            <p className="text-ui text-muted-foreground mb-2">Complete</p>
            <p className="text-heading font-bold">{stats.projectsByStatus.complete}</p>
          </div>
        </div>
      </section>

    </main>
  );
}
