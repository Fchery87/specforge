"use client";

import Link from "next/link";
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
import { cn } from "@/lib/utils";

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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading admin data...</span>
        </div>
      </main>
    );
  }

  // Helper to check credential status
  const getCredentialStatus = (providerId: string) => {
    const cred = systemCredentials?.find((c: any) => c.provider === providerId);
    if (!cred) return { configured: false, enabled: false };
    return {
      configured: !!cred.apiKey,
      enabled: cred.isEnabled,
    };
  };

  const enabledModelsCount = models?.filter((m: any) => m.enabled).length || 0;
  const configuredProviders = PROVIDERS.filter(p => getCredentialStatus(p.id).configured).length;

  // Helper to get activity icon based on type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'generating':
        return <Play className="w-4 h-4 text-primary" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'context':
        return <FileCode className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
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

  return (
    <main className="relative">
      {/* Hero Header with Grid Background */}
      <section className="page-header relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-fade opacity-20" />
        <div className="page-container relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Admin Console
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            System <span className="text-primary">Control</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Monitor and configure system-wide settings, LLM providers, and credentials.
          </p>
        </div>
      </section>

      {/* Stats Grid Section */}
      <section className="page-section page-container">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Projects */}
          <Card variant="default">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-primary bg-primary/10 flex items-center justify-center mb-4">
                <FolderOpen className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.totalProjects}</p>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>{stats.projectsByStatus.active} active</span>
                <span>{stats.projectsByStatus.complete} complete</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Artifacts */}
          <Card variant="default">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Total Artifacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.totalArtifacts}</p>
              <p className="mt-2 text-sm text-muted-foreground">Generated documents</p>
            </CardContent>
          </Card>

          {/* Users with Config */}
          <Card variant="default">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Users Configured
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.totalUsersWithConfig}</p>
              <p className="mt-2 text-sm text-muted-foreground">With LLM settings</p>
            </CardContent>
          </Card>

          {/* Models Enabled */}
          <Card variant="default">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-medium normal-case">
                Models Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{enabledModelsCount}</p>
              <p className="mt-2 text-sm text-muted-foreground">of {models?.length || 0} configured</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Provider Status Section */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
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
                  "p-4 border-2 transition-all",
                  isActive 
                    ? "border-primary/50 bg-primary/5" 
                    : status.configured 
                      ? "border-border bg-secondary/20 opacity-60"
                      : "border-border/50 bg-background opacity-40"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Key className={cn(
                    "w-5 h-5",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )} />
                  {isActive ? (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  ) : status.configured ? (
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="font-bold uppercase tracking-tight text-sm">
                  {provider.short}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isActive ? "Active" : status.configured ? "Disabled" : "Not Set"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Navigation Section */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Quick Actions
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* User Management */}
          <Link href="/admin/users" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <Users className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  View users, manage roles, and audit user activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  Manage Users <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Project Management */}
          <Link href="/admin/projects" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <FolderOpen className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>Project Control Center</CardTitle>
                <CardDescription>
                  Cross-user project visibility, bulk operations, and moderation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  Manage Projects <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Analytics */}
          <Link href="/admin/analytics" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <BarChart3 className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>Usage Analytics</CardTitle>
                <CardDescription>
                  Token consumption, cost tracking, and usage patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  View Analytics <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* System Health */}
          <Link href="/admin/health" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <Activity className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>System Health</CardTitle>
                <CardDescription>
                  Monitor LLM provider health, queue status, and performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  Monitor Health <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Security & Audit */}
          <Link href="/admin/security" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <Lock className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>Security & Audit</CardTitle>
                <CardDescription>
                  Security events, audit trails, and administrative actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  View Logs <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Settings */}
          <Link href="/admin/settings" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <Settings className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>
                  Feature flags, rate limits, and system-wide configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  Configure <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Content Moderation */}
          <Link href="/admin/moderation" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <Flag className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>Content Moderation</CardTitle>
                <CardDescription>
                  Review artifacts, templates, and content filtering
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  Moderate <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* LLM Models */}
          <Link href="/admin/llm-models" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <Sparkles className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>LLM Models</CardTitle>
                <CardDescription>
                  Configure available models, token limits, and provider settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  Manage Models <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* System Credentials */}
          <Link href="/admin/llm-models" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <Key className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>System Credentials</CardTitle>
                <CardDescription>
                  Configure API keys for system-wide LLM access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  Configure Keys <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Activity Monitor */}
          <Link href="/admin/activity" className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <Activity className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>Activity Monitor</CardTitle>
                <CardDescription>
                  View recent generation activity and system logs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground group-hover:text-primary font-bold uppercase tracking-tight transition-colors">
                  View Activity <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Activity Feed */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Recent Activity
          </h2>
          <p className="text-muted-foreground mt-2">
            Latest generation tasks and system events
          </p>
        </div>

        <Card variant="default">
          <CardContent className="p-0">
            {activities && activities.length > 0 ? (
              <div className="divide-y divide-border">
                {activities.map((activity: any) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="mt-1 flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none mb-1">
                        {activity.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Project: {activity.projectId} • Phase: {activity.phaseId}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1",
                          activity.taskStatus === 'completed'
                            ? "bg-green-500/10 text-green-500"
                            : activity.taskStatus === 'failed'
                            ? "bg-red-500/10 text-red-500"
                            : "bg-yellow-500/10 text-yellow-500"
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
                <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-1">Activity will appear here when users generate artifacts</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Projects Breakdown */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Project Breakdown
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-6 border-2 border-border bg-background">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Draft</p>
            <p className="text-5xl font-bold">{stats.projectsByStatus.draft}</p>
          </div>
          <div className="p-6 border-2 border-primary/50 bg-primary/5">
            <p className="text-sm text-primary uppercase tracking-wider mb-2">Active</p>
            <p className="text-5xl font-bold text-primary">{stats.projectsByStatus.active}</p>
          </div>
          <div className="p-6 border-2 border-border bg-background">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Complete</p>
            <p className="text-5xl font-bold">{stats.projectsByStatus.complete}</p>
          </div>
        </div>
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        ADMIN
      </div>
    </main>
  );
}
