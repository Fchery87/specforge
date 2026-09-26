"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Sparkles, ArrowRight, Clock, Zap, Loader2, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { PersonalAnalytics } from "@/components/dashboard/personal-analytics";
import { PinnedProjects } from "@/components/dashboard/pinned-projects";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardSearch } from "@/components/dashboard/dashboard-search";
import { ProjectCard } from "@/components/dashboard/project-card";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { SpecForgeLogo } from "@/components/ui/logo";

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}


export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  
  const projects = useQuery(
    api.projects.getProjects,
    isLoaded && isSignedIn ? {} : "skip"
  );

  const recentProjects = useQuery(
    api.userDashboard.getRecentProjects,
    isLoaded && isSignedIn ? { limit: 5 } : "skip"
  );

  const pinnedProjects = useQuery(
    api.userPreferences.getPinnedProjects,
    isLoaded && isSignedIn ? {} : "skip"
  );

  const deleteProjectMutation = useMutation(api.projects.deleteProject);

  const [deleteDialogState, setDeleteDialogState] = useState<{
    open: boolean;
    projectId: Id<"projects"> | null;
    projectTitle: string;
  }>({ open: false, projectId: null, projectTitle: "" });
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  if (!isLoaded) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="page-container py-20">
        <div className="text-center">
          <p className="text-muted-foreground">You must be signed in to access the dashboard.</p>
          <Button asChild className="mt-4">
            <Link href={"/sign-in" as Route}>Sign In</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (projects === undefined) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  const pinnedIds = new Set((pinnedProjects || []).map((p: { _id: string }) => p._id));
  
  let sortedProjects = [...(projects || [])].sort((a, b) => b.updatedAt - a.updatedAt);
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    sortedProjects = sortedProjects.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );
  }

  if (statusFilter.length > 0) {
    sortedProjects = sortedProjects.filter((p) => statusFilter.includes(p.status));
  }

  async function handleDeleteProject() {
    if (!deleteDialogState.projectId) return;
    
    setIsDeleting(true);
    try {
      await deleteProjectMutation({ projectId: deleteDialogState.projectId });
      toast.success("Project deleted successfully");
      setDeleteDialogState({ open: false, projectId: null, projectTitle: "" });
    } catch (error) {
      toast.error("Failed to delete project", {
        description: error instanceof Error ? error.message : "Please try again or check if the project has active generations.",
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main>
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogState.open}
        onOpenChange={(open) => setDeleteDialogState((s) => ({ ...s, open }))}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteDialogState.projectTitle}"? This will permanently remove the project and all associated phases and artifacts.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteProject}
        isLoading={isDeleting}
      />

      {/* Hero header */}
      <section className="page-header">
        <div className="page-container">
          <div className="mb-4 flex items-center justify-between gap-4">
            <span className="text-label text-dim">Command Center</span>
            <NotificationBell />
          </div>
          <h1 className="mt-2 text-heading font-medium text-ink">Your Projects</h1>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-muted-foreground">Manage specification pipelines, review evidence changes, and export agent-native handoffs.</p>
        </div>
      </section>

      {/* Personal Analytics Widget */}
      <section className="page-section page-container border-t border-line">
        <PersonalAnalytics />
      </section>

      {/* Pinned Projects */}
      <section className="page-section page-container border-t border-line">
        <PinnedProjects />
      </section>

      {/* Quick Actions */}
      <section className="page-section page-container border-t border-line">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* New Project Card - Primary CTA */}
          <Link href="/dashboard/new" className="md:col-span-2 lg:col-span-1 block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-primary bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:border-primary transition-colors">
                  <Plus className="size-7 text-primary transition-colors" />
                </div>
                <CardTitle>New Project</CardTitle>
                <CardDescription>
                  Run the complete specification pipeline with codebase scanning, evidence linking, and tracer bullet decomposition
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary font-bold transition-colors">
                  Create Project <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Recent Activity Card */}
          <Card variant="default">
            <CardHeader>
              <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4">
                <Clock className="size-7 text-muted-foreground" />
              </div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your latest project updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentProjects && recentProjects.length > 0 ? (
                <ul className="space-y-2">
                  {recentProjects.map((project) => (
                    <li key={project._id} className="flex items-center justify-between text-ui">
                      <Link
                        href={`/project/${project._id}`}
                        className="text-ink hover:text-primary transition-colors truncate max-w-[180px]"
                      >
                        {project.title}
                      </Link>
                      <span className="text-muted-foreground text-caption">
                        {getRelativeTime(project.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-ui">No recent activity</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Spec Card */}
          <Link href={"/dashboard/quick" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="size-14 border border-line bg-raised/30 flex items-center justify-center mb-4 group-hover:border-primary group-hover:bg-primary/10 transition-colors">
                  <Zap className="size-7 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>Quick Spec</CardTitle>
                <CardDescription>
                  Generate a fast one-page architectural spec and Mermaid diagram, then save directly to project history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary font-bold text-ui transition-colors">
                  Open Quick Spec <ArrowRight className="size-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Projects List Section with Search */}
      <section className="page-section page-container border-t border-line">
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-title font-bold">
              All Projects
            </h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/new">
                <Plus className="size-4 mr-2" /> New
              </Link>
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search projects by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 bg-raised/30 border border-line/50 focus:bg-void transition-colors text-ui"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {['draft', 'active', 'complete'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev.includes(status)
                        ? prev.filter((s) => s !== status)
                        : [...prev, status]
                    );
                  }}
                  className={cn(
                    "px-3 py-1.5 text-caption font-medium capitalize transition-colors border",
                    statusFilter.includes(status)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-void text-muted-foreground border-line hover:border-muted-foreground"
                  )}
                >
                  {status}
                </button>
              ))}

              {(searchQuery || statusFilter.length > 0) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter([]);
                  }}
                  className="text-caption text-muted-foreground hover:text-ink transition-colors ml-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <p className="text-caption text-muted-foreground">
            {sortedProjects.length} {sortedProjects.length === 1 ? 'project' : 'projects'} found
          </p>
        </div>

        {sortedProjects.length === 0 ? (
          <EmptyState
            variant="folder"
            title={searchQuery || statusFilter.length > 0 ? "No Projects Match" : "No Projects Yet"}
            description={
              searchQuery || statusFilter.length > 0
                ? "Try adjusting your search query or status filter."
                : "Create your first project to begin generating specifications, domain models, and agent handoff files."
            }
          >
            {searchQuery || statusFilter.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter([]);
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            ) : (
              <Link href="/dashboard/new">
                <Button className="mt-4">
                  <Plus className="size-4 mr-2" /> Create First Project
                </Button>
              </Link>
            )}
          </EmptyState>
        ) : (
          /* Projects Grid with Progress */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => (
              <ProjectCard
                key={project._id}
                project={project}
                isPinned={pinnedIds.has(project._id)}
                onDelete={() => {
                  setDeleteDialogState({
                    open: true,
                    projectId: project._id,
                    projectTitle: project.title,
                  });
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Activity Feed Section */}
      <section className="page-section page-container border-t border-line">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-title font-bold mb-6">
              Activity Feed
            </h2>
            <ActivityFeed />
          </div>
          <div>
            <h2 className="text-title font-bold mb-6">
              Quick Stats
            </h2>
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-heading font-semibold text-primary">
                    {projects?.length || 0}
                  </div>
                  <p className="text-ui text-muted-foreground mt-1">Total Projects</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-heading font-semibold">
                    {projects?.filter((p) => p.status === "active").length || 0}
                  </div>
                  <p className="text-ui text-muted-foreground mt-1">Active Projects</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-heading font-semibold text-sage">
                    {projects?.filter((p) => p.status === "complete").length || 0}
                  </div>
                  <p className="text-ui text-muted-foreground mt-1">Completed</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
