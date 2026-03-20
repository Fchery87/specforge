"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PhaseStepper } from "@/components/phase-stepper";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProjectPhaseCard } from "@/components/project-phase-card";
import { Sparkles, Layers, FileText, Code, Package, Target, ClipboardList, Loader2 } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { toast } from "sonner";

const PHASES = [
  { id: "constitution", label: "Constitution", icon: FileText, description: "Immutable truths and core constraints" },
  { id: "brief", label: "Brief", icon: FileText, description: "Define your project scope and requirements" },
  { id: "prd", label: "PRD", icon: Target, description: "Formal product requirements and goals" },
  { id: "domainModel", label: "Domain Model", icon: Layers, description: "Entities, rules, and state transitions" },
  { id: "specs", label: "Spec & Architecture", icon: Code, description: "Technical specifications and design" },
  { id: "stories", label: "Tasks/Stories", icon: ClipboardList, description: "User stories and task breakdown" },
  { id: "artifacts", label: "Artifacts", icon: Sparkles, description: "Generated assets and codebase models" },
  { id: "handoff", label: "Handoff + ZIP", icon: Package, description: "Final deliverables and documentation" },
];

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const toggleSkip = useMutation(api.projects.toggleSkipPhase);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateAllAction = (api as any)['actions/generateAllPhases']?.generateAllPhases as any;
  const generateAll = useAction(generateAllAction);

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
  if (!project) {
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
  ) || PHASES.some(p => !skippedPhases.includes(p.id) && !phaseStatusMap.has(p.id));

  async function handleGenerateAll() {
    setIsGeneratingAll(true);
    try {
      const result = await generateAll({ projectId: params.id as Id<"projects"> });
      toast.success(`Scheduled ${result.scheduled} phase${result.scheduled === 1 ? '' : 's'} for generation`);
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
          currentPhase="constitution"
          phaseStatuses={Object.fromEntries(phaseStatusMap)}
        />
      </section>

      {/* Phase Cards */}
      <section className="page-container page-section border-t-2 border-border relative z-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter">
            Workflow Phases
          </h2>
          {/* Generate All button */}
          <Button
            onClick={handleGenerateAll}
            disabled={isGeneratingAll || !hasPendingPhases}
            className="gap-2"
          >
            {isGeneratingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate All Phases
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PHASES.map((phase, idx) => (
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
                phase.id !== "constitution"
                  ? (skip: boolean) =>
                      toggleSkip({ projectId: params.id as Id<"projects">, phaseId: phase.id, skip })
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      {/* Decorative Element */}
      <div className="text-[12vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden mt-12">
        {project.title?.split(' ')[0]?.toUpperCase() || 'PROJECT'}
      </div>
    </main>
  );
}
