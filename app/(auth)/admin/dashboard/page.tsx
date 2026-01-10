"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, FileText, Users, Activity } from "lucide-react";

export default function AdminDashboardPage() {
  const stats = useQuery((api as any).admin?.getSystemStats);

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-white/70 mt-2">System overview and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-white/60">Created projects</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Artifacts</CardTitle>
            <FileText className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArtifacts}</div>
            <p className="text-xs text-white/60">Generated documents</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsersWithConfig}</div>
            <p className="text-xs text-white/60">Users with LLM config</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Activity</CardTitle>
            <Activity className="h-4 w-4 text-white/60" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.projectsByStatus.active}
            </div>
            <p className="text-xs text-white/60">Active projects</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/70">Draft</span>
              <Badge variant="outline">{stats.projectsByStatus.draft}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Active</span>
              <Badge variant="default">{stats.projectsByStatus.active}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70">Complete</span>
              <Badge variant="secondary">{stats.projectsByStatus.complete}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/admin/llm-models"
              className="block p-3 rounded-lg bg-bg border border-border hover:bg-card transition"
            >
              <p className="font-medium">Manage LLM Models</p>
              <p className="text-sm text-white/60">Configure available models</p>
            </a>
            <a
              href="/settings/llm-config"
              className="block p-3 rounded-lg bg-bg border border-border hover:bg-card transition"
            >
              <p className="font-medium">LLM Configuration</p>
              <p className="text-sm text-white/60">Configure your API keys</p>
            </a>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader>
            <CardTitle>System Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Version</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Environment</span>
              <Badge variant="outline">Development</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Database</span>
              <Badge variant="outline">Convex</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
