"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PhaseStepper } from "@/components/phase-stepper";
import { generateAllPhasesAction } from "@/lib/convex-actions";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProjectPhaseCard } from "@/components/project-phase-card";
import { Sparkles, Loader2 } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { PROJECT_PHASES } from "@/lib/phase-config";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const toggleSkip = useMutation(api.projects.toggleSkipPhase);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [showGenerateAllConfirm, setShowGenerateAllConfirm] = useState(false);
  const generateAll = useAction(generateAllPhasesAction);

  const project = useQuery(
    api.projects.getProject,
    isLoaded && isSignedIn ? { projectId: params.id as Id<"projects"> } : "skip"
  );
  const phases = useQuery(
    api.projects.getProjectPhases,
    isLoaded && isSignedIn ? { projectId: params.id as Id<"projects"> } : "skip"
  );

  // Show loading while auth is initializing
  if (!isLoaded) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  // Show loading skeleton while project data is being fetched
  // Check if project is undefined (loading) vs null (not found)
  if (project === undefined) {
    return (
      <main className="relative min-h-[calc(100vh-5rem)]">
        <div className="absolute inset-0 bg-grid-fade opacity-10" />
        <div className="page-container py-6">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="page-container">
          <div className="mb-12">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-16 w-2/3 mb-4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </main>
    );
  }

  // If project is null, it doesn't exist or user doesn't have access
  if (project === null) {
    // This will trigger the not-found.tsx page
    return (
      <main className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center">
        <div className="absolute inset-0 bg-grid-fade opacity-10" />
        <div className="text-center">
          <div className="text-[15vw] font-bold uppercase tracking-tighter text-muted-foreground/20 leading-none mb-4">
            404
          </div>
          <h1 className="text-v-h2 mb-4">Project Not Found</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  const skippedPhases = project.skippedPhases ?? [];

  const phaseStatusMap = new Map<
    string,
    "pending" | "generating" | "ready" | "error" | "skipped"
  >(
    (phases ?? []).map((phase) => [
      phase.phaseId,
      skippedPhases.includes(phase.phaseId) ? "skipped" : phase.status,
    ])
  );

  const hasPendingPhases = [...phaseStatusMap.values()].some(
    s => s === 'pending'
  ) || PROJECT_PHASES.some(p => !skippedPhases.includes(p.id) && !phaseStatusMap.has(p.id));

  async function handleGenerateAll() {
    setShowGenerateAllConfirm(false);
    setIsGeneratingAll(true);
    try {
      const result = await generateAll({ projectId: params.id as Id<"projects"> });
      const count = result?.scheduled ?? 0;
      toast.success(`Scheduled ${count} phase${count === 1 ? '' : 's'} for generation`);
    } catch {
      toast.error('Failed to schedule generation');
    } finally {
      setIsGeneratingAll(false);
    }
  }

  return (
    <main className="relative min-h-[calc(100vh-5rem)]">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-fade opacity-10" />

      {/* Back Navigation */}
      <div className="page-container py-6 relative z-10">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: project?.title ?? "Project" },
          ]}
        />
      </div>

      {/* Project Header */}
      <section className="page-container pb-12 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Project
          </span>
          {project.mode === 'quick' && (
            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-500 border border-sky-500/30 rounded-full">
              Quick Feature Spec
            </span>
          )}
          {project.mode === 'backend' && (
            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-500 border border-purple-500/30 rounded-full">
              API & Backend Service
            </span>
          )}
          {project.mode === 'full' && (
            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-secondary text-foreground border border-border rounded-full">
              Full System Blueprint
            </span>
          )}
        </div>
        <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
          {project.title}
        </h1>
        {project.description && (
          <p className="text-xl text-muted-foreground max-w-3xl line-clamp-2">
            {project.description}
          </p>
        )}
      </section>

      {/* Phase Stepper */}
      <section className="page-container pb-8 relative z-10">
        <PhaseStepper
          projectId={params.id}
          currentPhase={
            // Find the first phase that is not 'ready' and not 'skipped'
            PROJECT_PHASES.find((p) => {
              const status = phaseStatusMap.get(p.id);
              return !status || (status !== 'ready' && status !== 'skipped');
            })?.id ?? 'brief'
          }
          phaseStatuses={Object.fromEntries(phaseStatusMap)}
        />
      </section>

      {/* Phase Cards */}
      <section className="page-container page-section border-t-2 border-border relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Workflow Phases
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/project/${params.id}/quick` as Route}>Quick Spec history</Link>
            </Button>
            <Button
              onClick={() => setShowGenerateAllConfirm(true)}
              disabled={isGeneratingAll || !hasPendingPhases}
              className="gap-2"
            >
              {isGeneratingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate All Phases
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROJECT_PHASES.map((phase, idx) => (
            <ProjectPhaseCard
              key={phase.id}
              projectId={params.id}
              phaseId={phase.id}
              label={phase.label}
              description={phase.description}
              icon={phase.icon}
              index={idx}
              status={phaseStatusMap.get(phase.id)}
              isSkipped={skippedPhases.includes(phase.id)}
              onToggleSkip={
                phase.id !== "constitution" || skippedPhases.includes("constitution")
                  ? (skip: boolean) =>
                      toggleSkip({ projectId: params.id as Id<"projects">, phaseId: phase.id, skip })
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      {/* Decorative Watermark */}
      <div className="max-w-full overflow-hidden text-[clamp(2.5rem,10vw,7.5rem)] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none truncate mt-12">
        {project.title?.split(' ')[0]?.toUpperCase() || 'PROJECT'}
      </div>

      {/* Generate All Confirmation Dialog */}
      <ConfirmDialog
        open={showGenerateAllConfirm}
        onOpenChange={setShowGenerateAllConfirm}
        title="Generate All Pending Phases"
        description="This will sequentially queue all remaining un-generated phases for generation. Each phase preserves invariants from prior outputs and extracts verifiable contracts. Are you sure you want to proceed?"
        confirmLabel="Generate All"
        variant="default"
        onConfirm={handleGenerateAll}
      />
    </main>
  );
}
