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
  Activity
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
  if (stats === undefined || systemCredentials === undefined || models === undefined) {
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <Card variant="default" className="h-full opacity-60">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4">
                <Activity className="w-7 h-7 text-muted-foreground" />
              </div>
              <CardTitle>Activity Monitor</CardTitle>
              <CardDescription>
                View generation logs and rate limit status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-muted-foreground font-bold uppercase tracking-tight">
                Coming Soon
              </div>
            </CardContent>
          </Card>
        </div>
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
