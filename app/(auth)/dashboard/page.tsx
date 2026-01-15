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
import { Plus, Sparkles, ArrowRight, Clock, Zap, Loader2, Trash2 } from "lucide-react";

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

  const deleteProjectMutation = useMutation(api.projects.deleteProject);

  const [deleteDialogState, setDeleteDialogState] = useState<{
    open: boolean;
    projectId: Id<"projects"> | null;
    projectTitle: string;
  }>({ open: false, projectId: null, projectTitle: "" });

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

  const sortedProjects = [...(projects || [])].sort((a, b) => b.createdAt - a.createdAt);
  const recentByUpdated = [...(projects || [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const mostRecentProject = recentByUpdated[0] || null;

  async function handleDeleteProject() {
    if (deleteDialogState.projectId) {
      await deleteProjectMutation({ projectId: deleteDialogState.projectId });
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
      />

      {/* Hero Header with Grid Background */}
      <section className="page-header relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-fade opacity-20" />
        <div className="page-container relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Command Center
            </span>
          </div>
          <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
            Your <span className="text-primary">Projects</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Create, manage, and forge your ideas into fully-specified, production-ready projects.
          </p>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="page-section page-container">
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
              {recentByUpdated.length === 0 ? (
                <p className="text-muted-foreground text-sm">No recent activity</p>
              ) : (
                <ul className="space-y-2">
                  {recentByUpdated.map((project) => (
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
              )}
            </CardContent>
          </Card>

          {/* Quick Start Card */}
          <Card variant="default">
            <CardHeader>
              <div className="w-14 h-14 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4">
                <Zap className="w-7 h-7 text-muted-foreground" />
              </div>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>
                Jump back into an existing project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mostRecentProject ? (
                <Link
                  href={`/project/${mostRecentProject._id}`}
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors group"
                >
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="truncate">{mostRecentProject.title}</span>
                </Link>
              ) : (
                <p className="text-muted-foreground text-sm">No projects yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Projects List Section */}
      <section className="page-section page-container border-t-2 border-border">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            All Projects
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/new">
              <Plus className="w-4 h-4 mr-2" /> New
            </Link>
          </Button>
        </div>

        {sortedProjects.length === 0 ? (
          /* Empty State */
          <EmptyState
            variant="folder"
            title="No Projects Yet"
            description="Create your first project to start generating specs, stories, and artifacts with AI assistance."
          >
            <Link href="/dashboard/new">
              <Button className="mt-4">
                <Plus className="w-4 h-4 mr-2" /> Create First Project
              </Button>
            </Link>
          </EmptyState>
        ) : (
          /* Projects Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedProjects.map((project) => (
              <div key={project._id} className="relative group/card">
                <Link href={`/project/${project._id}`} className="block">
                  <Card variant="interactive" className="h-full group">
                    <CardHeader>
                      <CardTitle className="text-lg normal-case tracking-normal font-semibold group-hover:text-black transition-colors">
                        {project.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 group-hover:text-black/70">
                        {project.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground capitalize group-hover:text-black/60">{project.status}</span>
                        <span className="text-muted-foreground group-hover:text-black/60">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                {/* Delete Button */}
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
                  className="absolute top-4 right-4 p-2 opacity-0 group-hover/card:opacity-100 bg-background/80 hover:bg-destructive hover:text-destructive-foreground border border-border hover:border-destructive transition-all z-10"
                  aria-label={`Delete ${project.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Decorative Footer Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden">
        FORGE
      </div>
    </main>
  );
}
