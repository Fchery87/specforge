"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getAllProjectArtifactsAction,
  generateProjectZipAction,
} from "@/lib/convex-actions";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StageStepper } from "@/components/stage-stepper";
import { NextActionPanel } from "@/components/next-action-panel";
import { PhaseLedger } from "@/components/phase-ledger";
import { AddSectionMenu } from "@/components/add-section-menu";
import { ProjectRulesCard } from "@/components/project-rules-card";
import { ExportOptionsPanel } from "@/components/export-options";
import { Sparkles, Loader2, Download } from "lucide-react";
import { CodebaseConnector } from "@/components/codebase-connector";
import { GenerationReadinessBanner } from "@/components/generation-readiness-banner";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PHASE_ORDER,
  MODE_POLICIES,
  currentPhaseFor,
  nextAction,
  phaseLabel,
  type PhaseId,
  type ProjectMode,
} from "@/lib/workflow";
import { getToastMessage } from "@/lib/notifications";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const toggleSkip = useMutation(api.projects.toggleSkipPhase);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const generateZip = useAction(generateProjectZipAction);
  const convex = useConvex();

  const project = useQuery(
    api.projects.getProject,
    isLoaded && isSignedIn ? { projectId: params.id as Id<"projects"> } : "skip"
  );
  const phases = useQuery(
    api.projects.getProjectPhases,
    isLoaded && isSignedIn ? { projectId: params.id as Id<"projects"> } : "skip"
  );
  const allArtifacts = useQuery(
    getAllProjectArtifactsAction,
    isLoaded && isSignedIn ? { projectId: params.id as Id<"projects"> } : "skip"
  );
  const readiness = useQuery(
    api.userConfigs.getGenerationReadiness,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const stageQuality = useQuery(
    api.stageReports.getProjectStageQuality,
    isLoaded && isSignedIn ? { projectId: params.id as Id<"projects"> } : "skip"
  );

  // Show loading while auth is initializing
  if (!isLoaded) {
    return (
      <main className="page-container py-20">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </main>
    );
  }

  // Show loading skeleton while project data is being fetched
  // Check if project is undefined (loading) vs null (not found)
  if (project === undefined) {
    return (
      <main className="min-h-[calc(100vh-var(--header-height))]">
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
      <main className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center">
        <div className="page-container">
          <p className="font-mono text-caption text-dim">404</p>
          <h1 className="mt-2 text-heading font-medium text-ink">Project not found</h1>
          <p className="mt-3 max-w-md text-body leading-relaxed text-muted-foreground">
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button asChild className="mt-8">
            <Link href="/dashboard">Back to dashboard</Link>
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

  const hasPendingPhases = PHASE_ORDER.some((phaseId) => {
    if (skippedPhases.includes(phaseId)) return false;
    const status = phaseStatusMap.get(phaseId);
    return !status || status === "pending";
  });

  const hasQuickSpec = (allArtifacts ?? []).some((artifact) => artifact.type === "quickSpec");
  const mode = (project.mode ?? "full") as ProjectMode;
  const nextActionItem = nextAction(phases ?? [], skippedPhases as readonly PhaseId[], mode);
  const currentPhase = currentPhaseFor(nextActionItem, phases ?? [], skippedPhases);

  async function handleEnablePhase(phaseId: string) {
    try {
      await toggleSkip({
        projectId: params.id as Id<"projects">,
        phaseId,
        skip: false,
      });
      toast.success(`Enabled ${phaseLabel(phaseId)}`);
    } catch {
      toast.error(`Failed to enable ${phaseId}`);
    }
  }

  async function handleDownloadZip() {
    setIsDownloadingZip(true);
    const startToast = getToastMessage("export_start");
    const toastId = toast.message(startToast.title, {
      description: startToast.description,
    });
    try {
      if (!project?.zipStorageId) {
        await generateZip({ projectId: params.id as Id<"projects"> });
      }

      const zipUrl = await convex.query(api.projects.getProjectZipUrl, {
        projectId: params.id as Id<"projects">,
      });

      if (zipUrl) {
        window.location.href = zipUrl;
        const doneToast = getToastMessage("export_done");
        toast.success(doneToast.title, {
          id: toastId,
          description: doneToast.description,
        });
      } else {
        throw new Error("Failed to get download URL");
      }
    } catch (error) {
      toast.error("Download Failed", {
        id: toastId,
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDownloadingZip(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-var(--header-height))]">

      {/* Back Navigation */}
      <div className="page-container py-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: project?.title ?? "Project" },
          ]}
        />
      </div>

      <section className="page-container pb-16">
        <GenerationReadinessBanner ready={readiness?.ready ?? true} className="mb-6" />
        <div className="rounded-lg border border-line bg-surface px-5 py-7 md:px-8 md:py-9">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <h1 className="font-display text-heading font-semibold text-ink">{project.title}</h1>
              <p className="mt-2 text-label text-dim">
                {MODE_POLICIES[mode].label} mode
                {project.description ? (
                  <span className="mt-1 line-clamp-2 block max-w-[72ch] text-ui text-muted-foreground">
                    {project.description}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasQuickSpec ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/project/${params.id}/quick` as Route}>Saved quick specs</Link>
                </Button>
              ) : null}
              {hasPendingPhases ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/project/${params.id}/questions` as Route}>
                    <Sparkles aria-hidden className="size-4" />
                    Generate all phases
                  </Link>
                </Button>
              ) : null}
              <AddSectionMenu skippedPhases={skippedPhases} onEnable={handleEnablePhase} />
              <Button variant="outline" size="sm" onClick={() => setIsExportOpen(true)}>
                <Download aria-hidden className="size-4" />
                Export
              </Button>
            </div>
          </div>

          {/* One map, one instruction, one ledger. */}
          <StageStepper
            className="mt-9"
            projectId={params.id}
            currentPhase={currentPhase}
            phases={phases ?? []}
            skippedPhases={skippedPhases}
            quality={stageQuality}
          />

          <NextActionPanel
            className="mt-8"
            projectId={params.id}
            action={nextActionItem}
            skippedPhases={skippedPhases}
            quality={stageQuality}
          />

          <PhaseLedger
            className="mt-8"
            projectId={params.id}
            phases={phases ?? []}
            skippedPhases={skippedPhases}
            currentPhase={currentPhase}
          />
        </div>

        <div className="mt-8">
          <ProjectRulesCard
            projectId={params.id}
            constitutionContent={
              allArtifacts?.find((a) => a.type === "constitution")?.content
            }
          />
        </div>

        <div className="mt-8">
          <CodebaseConnector projectId={project._id} />
        </div>
      </section>

      {/* Export Dialog */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Export Project</DialogTitle>
            <DialogDescription>
              Export your specification bundle, AI agent guides, and project artifacts.
            </DialogDescription>
          </DialogHeader>
          <ExportOptionsPanel
            project={{
              _id: project._id,
              title: project.title,
              description: project.description,
              createdAt: project.createdAt,
              zipStorageId: project.zipStorageId,
            }}
            artifacts={{
              brief: allArtifacts?.find((a) => a.type === "brief")?.content,
              constitution: allArtifacts?.find((a) => a.type === "constitution")?.content,
              prd: allArtifacts?.find((a) => a.type === "prd")?.content,
              techSpec: allArtifacts?.find((a) => a.type === "techSpec")?.content,
              userStories: allArtifacts?.find((a) => a.type === "userStories")?.content,
              handoff: allArtifacts?.find((a) => a.type === "handoff")?.content,
            }}
            onDownloadZip={handleDownloadZip}
            isDownloadingZip={isDownloadingZip}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
