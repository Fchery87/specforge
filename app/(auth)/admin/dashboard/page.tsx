"use client";

import { useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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

  // Show loading while Clerk auth is initializing
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  // Show message if not signed in
  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-white/50">Please sign in to access the admin dashboard</p>
      </div>
    );
  }

  // Show loading while stats are being fetched
  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
        <span className="ml-2 text-white/50">Loading admin stats...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-white/70 mt-2">System overview and management</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalProjects}</p>
          </CardContent>
        </Card>
        
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Total Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalArtifacts}</p>
          </CardContent>
        </Card>
        
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white/60">Users with Config</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalUsersWithConfig}</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Status Breakdown */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle>Projects by Status</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-6">
          <div>
            <p className="text-sm text-white/60">Draft</p>
            <p className="text-xl font-semibold">{stats.projectsByStatus.draft}</p>
          </div>
          <div>
            <p className="text-sm text-white/60">Active</p>
            <p className="text-xl font-semibold">{stats.projectsByStatus.active}</p>
          </div>
          <div>
            <p className="text-sm text-white/60">Complete</p>
            <p className="text-xl font-semibold">{stats.projectsByStatus.complete}</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href="/admin/llm-models"
            className="block p-3 rounded-lg bg-background border border-border hover:bg-card transition"
          >
            <p className="font-medium">Manage LLM Models</p>
            <p className="text-sm text-white/60">Configure available models</p>
          </a>
          <a
            href="/settings/llm-config"
            className="block p-3 rounded-lg bg-background border border-border hover:bg-card transition"
          >
            <p className="font-medium">LLM Configuration</p>
            <p className="text-sm text-white/60">Configure your API keys</p>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
