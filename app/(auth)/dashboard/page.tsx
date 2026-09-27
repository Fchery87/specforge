"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Zap, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { PersonalAnalytics } from "@/components/dashboard/personal-analytics";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ProjectCard } from "@/components/dashboard/project-card";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { GenerationReadinessBanner } from "@/components/generation-readiness-banner";

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuth();
  
  const projects = useQuery(
    api.projects.getProjects,
    isLoaded && isSignedIn ? {} : "skip"
  );

  const pinnedProjects = useQuery(
    api.userPreferences.getPinnedProjects,
    isLoaded && isSignedIn ? {} : "skip"
  );

  const readiness = useQuery(
    api.userConfigs.getGenerationReadiness,
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
  
  // Pinned projects first, then the most recently updated.
  let sortedProjects = [...(projects || [])].sort(
    (a, b) =>
      Number(pinnedIds.has(b._id)) - Number(pinnedIds.has(a._id)) || b.updatedAt - a.updatedAt
  );
  
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

      <section className="page-container pt-10 pb-8 md:pt-14">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-heading font-semibold text-ink">Projects</h1>
            <p className="mt-2 max-w-xl text-body text-muted-foreground">
              How far each spec has come, and where it needs you.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NotificationBell />
            <Button asChild variant="outline">
              <Link href={"/dashboard/quick" as Route}>
                <Zap aria-hidden className="size-4" />
                Quick spec
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/new">
                <Plus aria-hidden className="size-4" />
                New project
              </Link>
            </Button>
          </div>
        </div>
        <GenerationReadinessBanner ready={readiness?.ready ?? true} className="mt-8" />
      </section>

      <section className="page-container pb-16">
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center">
            <div className="relative flex-1 lg:max-w-sm">
              <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
              <input
                type="search"
                aria-label="Search projects"
                placeholder="Search by title or description"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-sm border border-field bg-void pl-9 pr-3 text-ui text-ink placeholder:text-dim"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
              {(["draft", "active", "complete"] as const).map((status) => {
                const on = statusFilter.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setStatusFilter((prev) =>
                        prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
                      );
                    }}
                    className={cn(
                      "h-8 rounded-full border px-3 text-label capitalize transition-colors duration-(--duration-quick)",
                      on
                        ? "border-ink bg-ink text-void"
                        : "border-line text-muted-foreground hover:border-line-strong hover:text-ink"
                    )}
                  >
                    {status}
                  </button>
                );
              })}
              {(searchQuery || statusFilter.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter([]);
                  }}
                  className="ml-1 rounded-sm text-label text-muted-foreground hover:text-ink focus-ring"
                >
                  Clear filters
                </button>
              )}
            </div>

            <p className="text-label text-dim lg:ml-auto" aria-live="polite">
              {sortedProjects.length} {sortedProjects.length === 1 ? "project" : "projects"}
            </p>
          </div>

          {sortedProjects.length === 0 ? (
            <EmptyState
              variant="folder"
              title={searchQuery || statusFilter.length > 0 ? "No projects match" : "No projects yet"}
              description={
                searchQuery || statusFilter.length > 0
                  ? "Change the search or clear the status filter."
                  : "Start a project with a title and a paragraph. SpecForge asks what it needs before it writes anything."
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
                  Clear filters
                </Button>
              ) : (
                <Button asChild className="mt-4">
                  <Link href="/dashboard/new">
                    <Plus aria-hidden className="size-4" />
                    New project
                  </Link>
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="divide-y divide-line">
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
        </div>
      </section>

      <section className="page-container border-t border-line py-14">
        <PersonalAnalytics />
        <div className="mt-12">
          <h2 className="text-title font-semibold text-ink">Activity</h2>
          <div className="mt-5">
            <ActivityFeed />
          </div>
        </div>
      </section>

    </main>
  );
}
