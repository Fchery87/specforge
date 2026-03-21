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
import { Plus, Sparkles, ArrowRight, Clock, Zap, Loader2, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { PersonalAnalytics } from "@/components/dashboard/personal-analytics";
import { PinnedProjects } from "@/components/dashboard/pinned-projects";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardSearch } from "@/components/dashboard/dashboard-search";
import { ProjectCard } from "@/components/dashboard/project-card";
import { NotificationBell } from "@/components/dashboard/notification-bell";

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

const PHASE_ORDER = ['brief', 'constitution', 'prd', 'domainModel', 'spec', 'userStories', 'handoff'];

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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
    <main className="relative">
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

      {/* Hero Header with Grid Background */}
      <section className="page-header relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-fade opacity-20" />
        <div className="page-container relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-black" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Command Center
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4 mt-4">
            Your <span className="text-primary">Projects</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Create, manage, and forge your ideas into fully-specified, production-ready projects.
          </p>
        </div>
      </section>

      {/* Personal Analytics Widget */}
      <section className="page-section page-container">
        <PersonalAnalytics />
      </section>

      {/* Pinned Projects */}
      <section className="page-section page-container border-t-2 border-border pt-8">
        <PinnedProjects />
      </section>

      {/* Quick Actions */}
      <section className="page-section page-container border-t-2 border-border pt-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* New Project Card - Primary CTA */}
          <Link href="/dashboard/new" className="md:col-span-2 lg:col-span-1 block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-primary bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-black group-hover:border-black transition-colors">
                  <Plus className="w-7 h-7 text-primary group-hover:text-primary transition-colors" />
                </div>
                <CardTitle>New Project</CardTitle>
                <CardDescription>
                  Start from scratch with a fresh project brief
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary group-hover:text-black font-bold uppercase tracking-tight transition-colors">
                  Create Project <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Recent Activity Card */}
          <Card variant="default">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4">
                <Clock className="w-7 h-7 text-muted-foreground" />
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
                    <li key={project._id} className="flex items-center justify-between text-sm">
                      <Link
                        href={`/project/${project._id}`}
                        className="text-foreground hover:text-primary transition-colors truncate max-w-[180px]"
                      >
                        {project.title}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {getRelativeTime(project.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No recent activity</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Spec Card */}
          <Link href={"/dashboard/quick" as Route} className="block">
            <Card variant="interactive" className="h-full group">
              <CardHeader>
                <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:border-black group-hover:bg-black/10 transition-colors">
                  <Zap className="w-7 h-7 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <CardTitle>Quick Spec</CardTitle>
                <CardDescription>
                  Generate a focused spec from a single task description
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary group-hover:text-black font-bold uppercase tracking-tight text-sm transition-colors">
                  Open Quick Spec <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Projects List Section with Search */}
      <section className="page-section page-container border-t-2 border-border pt-8">
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
              All Projects
            </h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/new">
                <Plus className="w-4 h-4 mr-2" /> New
              </Link>
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 pr-4 bg-muted/30 border border-border/50 focus:bg-background transition-colors text-sm"
              />
            </div>

            <div className="flex gap-2">
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
                    "px-3 py-1.5 text-xs font-medium capitalize transition-colors border",
                    statusFilter.includes(status)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-muted-foreground"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>

            {(searchQuery || statusFilter.length > 0) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter([]);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {sortedProjects.length} {sortedProjects.length === 1 ? 'project' : 'projects'} found
          </p>
        </div>

        {sortedProjects.length === 0 ? (
          <EmptyState
            variant="folder"
            title={searchQuery || statusFilter.length > 0 ? "No Projects Match" : "No Projects Yet"}
            description={
              searchQuery || statusFilter.length > 0
                ? "Try adjusting your search or filters."
                : "Create your first project to start generating specs, stories, and artifacts with AI assistance."
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
                  <Plus className="w-4 h-4 mr-2" /> Create First Project
                </Button>
              </Link>
            )}
          </EmptyState>
        ) : (
          /* Projects Grid with Progress */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => (
              <div key={project._id} className="relative group">
                <Link href={`/project/${project._id}`} className="block">
                  <Card
                    variant="interactive"
                    className={cn(
                      "h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1",
                      "border-l-4",
                      project.status === "complete" && "border-l-emerald-500",
                      project.status === "active" && "border-l-primary",
                      project.status === "draft" && "border-l-muted"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">
                        {project.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-sm">
                        {project.description}
                      </CardDescription>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2 mt-3">
                        {project.status === "complete" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                            Complete
                          </span>
                        )}
                        {project.status === "active" && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-secondary text-muted-foreground">
                            Active
                          </span>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span className="font-medium">0%</span>
                        </div>
                        <Progress value={0} className="h-1.5" />
                      </div>

                      {/* Phase Indicators */}
                      <div className="flex gap-0.5">
                        {PHASE_ORDER.map((_, idx) => (
                          <div
                            key={idx}
                            className="h-1 flex-1 rounded-full bg-muted/50"
                          />
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span className="capitalize">{project.status}</span>
                        <span>Updated {getRelativeTime(project.updatedAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                {/* Action Menu */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteDialogState({
                        open: true,
                        projectId: project._id,
                        projectTitle: project.title,
                      });
                    }}
                    className="w-8 h-8 bg-background/90 backdrop-blur border border-border hover:border-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                    aria-label={`Delete ${project.title}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity Feed Section */}
      <section className="page-section page-container border-t-2 border-border pt-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-6">
              Activity Feed
            </h2>
            <ActivityFeed />
          </div>
          <div>
            <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-6">
              Quick Stats
            </h2>
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-4xl font-black text-primary">
                    {projects?.length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Total Projects</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-4xl font-black">
                    {projects?.filter((p) => p.status === "active").length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Active Projects</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-4xl font-black text-emerald-500">
                    {projects?.filter((p) => p.status === "complete").length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Completed</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        FORGE
      </div>
    </main>
  );
}
