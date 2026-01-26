"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useAction, useConvex, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { FunctionReference } from "convex/server";
import { PhaseStatusIndicator } from "@/components/phase-status";
import { ArtifactPreview } from "@/components/artifact-preview";
import { QuestionsPanel } from "@/components/questions-panel";
import { ArtifactsHeader } from "@/components/artifacts-header";
import { StreamingArtifactPreview } from "@/components/streaming-artifact-preview";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Loader2, Download, Archive, ArrowLeft, Sparkles, FileText, Layers, Code, Package } from "lucide-react";
import { toast } from "sonner";
import { getPhaseProgressMessage, getToastMessage } from "@/lib/notifications";

const PHASE_CONFIG: Record<string, { label: string; icon: typeof FileText; description: string }> = {
  brief: { label: "Brief", icon: FileText, description: "Define your project scope and goals" },
  prd: { label: "PRD", icon: FileText, description: "Product requirements and user needs" },
  specs: { label: "Specifications", icon: Layers, description: "Technical specifications and architecture" },
  stories: { label: "User Stories", icon: Code, description: "User stories and task breakdown" },
  artifacts: { label: "Artifacts", icon: Archive, description: "Supporting technical artifacts and docs" },
  handoff: { label: "Handoff", icon: Package, description: "Final artifacts and deliverables" },
};

export default function PhasePage() {
  const params = useParams<{ id: string; phaseId: string }>();
  const projectId = params.id;
  const phaseId = params.phaseId;
  const { isLoaded, isSignedIn } = useAuth();

  const project = useQuery(
    api.projects.getProject,
    isLoaded && isSignedIn ? { projectId: projectId as any } : "skip"
  );
  const phase = useQuery(
    api.projects.getPhase,
    isLoaded && isSignedIn ? { projectId: projectId as any, phaseId } : "skip"
  );
  const phases = useQuery(
    api.projects.getProjectPhases,
    isLoaded && isSignedIn ? { projectId: projectId as any } : "skip"
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generatePhaseAction = (api as any)["actions/generatePhase"]?.generatePhase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateZipAction = (api as any)["actions/generateProjectZip"]?.generateProjectZip as any;
  const generatePhase = useAction(generatePhaseAction);
  const generateZip = useAction(generateZipAction);
  const cancelArtifactStreaming = useMutation(api.artifacts.cancelArtifactStreaming as any);
  const getGenerationTaskQuery: any = (api as any)?.projects?.getGenerationTask;
  const convex = useConvex();
  const [isPhaseStarting, setIsPhaseStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [phaseTaskId, setPhaseTaskId] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const phaseToastIdRef = useRef<string | number | null>(null);
  const phaseStatusRef = useRef<string | null>(null);
  const phaseProgressRef = useRef<number | null>(null);
  const generationTask = useQuery(
    getGenerationTaskQuery,
    phaseTaskId ? { taskId: phaseTaskId as any } : "skip"
  );
  const getArtifactByPhaseQuery: any = (api as any)?.artifacts?.getArtifactByPhase;
  const streamingArtifact = useQuery(
    getArtifactByPhaseQuery,
    isLoaded && isSignedIn ? { projectId: projectId as any, phaseId } : "skip"
  );
  const isGenerating =
    isPhaseStarting || generationTask?.status === "in_progress";
  const hasStreamingPreview =
    !!(streamingArtifact as any)?.streamStatus ||
    !!(streamingArtifact as any)?.previewHtml ||
    !!(streamingArtifact as any)?.content;

  const phaseConfig = PHASE_CONFIG[phaseId] || { label: phaseId, icon: FileText, description: "" };
  const PhaseIcon = phaseConfig.icon;

  async function handleGeneratePhase() {
    setIsPhaseStarting(true);
    setPhaseTaskId(null);
    phaseStatusRef.current = null;
    phaseProgressRef.current = null;
    const startToast = getToastMessage("phase_start");
    const toastId = toast.message(startToast.title, {
      description: startToast.description,
    });
    phaseToastIdRef.current = toastId;
    try {
      const result = await generatePhase({ projectId: projectId as any, phaseId });
      setPhaseTaskId(result?.taskId ?? null);
      if (!result?.taskId) {
        throw new Error("Phase generation did not return a task id.");
      }
      if (result?.continuedSections) {
        const continuedToast = getToastMessage("phase_continued");
        toast.message(continuedToast.title, {
          description: `${continuedToast.description} (${result.continuedSections} section${result.continuedSections === 1 ? "" : "s"})`,
        });
      }
    } catch (error) {
      const errorToast = getToastMessage("phase_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
      setIsPhaseStarting(false);
    } finally {
    }
  }

  async function handleCancelGeneration() {
    if (!projectId || !phaseId) return;
    setIsCancelling(true);
    const toastId = toast.message("Cancelling generation...", {
      description: "Stopping the AI and preserving partial output.",
    });
    try {
      await cancelArtifactStreaming({ projectId: projectId as any, phaseId });
      toast.success("Cancelled", {
        id: toastId,
        description: "Partial output preserved. You can regenerate when ready.",
      });
    } catch (error) {
      toast.error("Cancel failed", {
        id: toastId,
        description: "Please try again.",
      });
    } finally {
      setIsCancelling(false);
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
        await generateZip({ projectId: projectId as any });
      }

      const zipUrl = await convex.query(api.projects.getProjectZipUrl, {
        projectId: projectId as any,
      });

      if (zipUrl) {
        window.location.href = zipUrl;
        const doneToast = getToastMessage("export_done");
        toast.success(doneToast.title, {
          id: toastId,
          description: doneToast.description,
        });
      } else {
        console.warn("ZIP download is not available yet.");
        const errorToast = getToastMessage("export_error");
        toast.error(errorToast.title, {
          id: toastId,
          description: errorToast.description,
        });
      }
    } catch (error) {
      const errorToast = getToastMessage("export_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
    } finally {
      setIsDownloadingZip(false);
    }
  }

  useEffect(() => {
    if (!generationTask || !phaseTaskId) return;
    if (generationTask.status === phaseStatusRef.current) {
      if (generationTask.status !== "in_progress") return;
    }

    const toastId = phaseToastIdRef.current ?? undefined;
    if (generationTask.status === "in_progress") {
      const progress =
        (generationTask.currentStep ?? 0) + 1;
      if (phaseProgressRef.current !== progress) {
        phaseProgressRef.current = progress;
        const message = getPhaseProgressMessage(
          progress,
          generationTask.totalSteps ?? 1
        );
        toast.message(message.title, {
          id: toastId,
          description: message.description,
        });
      }
    } else if (generationTask.status === "completed") {
      const doneToast = getToastMessage("phase_done");
      toast.success(doneToast.title, {
        id: toastId,
        description: doneToast.description,
      });
      phaseStatusRef.current = generationTask.status;
    } else if (generationTask.status === "failed") {
      const errorToast = getToastMessage("phase_error");
      toast.error(errorToast.title, {
        id: toastId,
        description: errorToast.description,
      });
      phaseStatusRef.current = generationTask.status;
    }
  }, [generationTask, phaseTaskId]);

  useEffect(() => {
    if (generationTask && isPhaseStarting) {
      setIsPhaseStarting(false);
    }
  }, [generationTask, isPhaseStarting]);

  // Loading state
  if (!phase || !project) {
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
          <div className="space-y-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(100vh-5rem)]">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-fade opacity-10" />

      {/* Back Navigation */}
      <div className="page-container py-6 relative z-10">
        <Link 
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </Link>
      </div>

      {/* Phase Header */}
      <section className="page-container pb-8 relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary flex items-center justify-center">
            <PhaseIcon className="w-5 h-5 text-black" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {phaseConfig.label}
          </span>
        </div>
        <h1 className="text-v-h2 font-bold leading-none uppercase tracking-tighter mb-4">
          {project.title}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          {phaseConfig.description}
        </p>
      </section>

      {/* Phase Status Indicator */}
      <section className="page-container pb-8 relative z-10">
        <PhaseStatusIndicator
          phases={phases ?? []}
          currentPhase={phaseId}
          projectId={projectId}
        />
      </section>

      {/* Main Content Grid */}
      <section className="page-container page-section border-t-2 border-border relative z-10">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column: Questions */}
          <div>
            <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-6">
              Clarifications
            </h2>
            <QuestionsPanel
              projectId={projectId}
              phaseId={phaseId}
              questions={phase.questions}
              onGeneratePhase={handleGeneratePhase}
              isGenerating={isGenerating}
              onCancelGeneration={handleCancelGeneration}
              isCancelling={isCancelling}
            />
          </div>

          {/* Right Column: Artifacts */}
          <div>
            <ArtifactsHeader
              streamStatus={(streamingArtifact as any)?.streamStatus}
              hasArtifacts={!!phase.artifacts && phase.artifacts.length > 0}
              onDownloadAll={handleDownloadZip}
              isDownloading={isDownloadingZip}
            />

            <Card variant="static">
              <CardContent className="p-6">
                {hasStreamingPreview && (
                  <div className="mb-4">
                    <StreamingArtifactPreview
                      title={(streamingArtifact as any)?.title ?? "Generating…"}
                      previewHtml={(streamingArtifact as any)?.previewHtml ?? ""}
                      streamStatus={(streamingArtifact as any)?.streamStatus}
                      currentSection={(streamingArtifact as any)?.currentSection}
                      sectionsCompleted={(streamingArtifact as any)?.sectionsCompleted}
                      sectionsTotal={(streamingArtifact as any)?.sectionsTotal}
                    />
                  </div>
                )}
                {(phase.artifacts ?? []).length > 0 ? (
                  <div className="space-y-4">
                    {phase.artifacts.map((a: any) => (
                      <ArtifactPreview 
                        key={a._id} 
                        artifact={a}
                        onDelete={() => {}}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    variant="inbox"
                    title="No Artifacts Yet"
                    description="Answer the questions and click 'Generate Phase' to create artifacts."
                    className="py-12"
                  />
                )}
              </CardContent>
            </Card>

            {/* Download ZIP button for handoff phase */}
            {phaseId === "handoff" && (
              <div className="mt-6">
                <Button 
                  onClick={handleDownloadZip} 
                  disabled={isDownloadingZip}
                  className="w-full h-16 text-lg"
                >
                  {isDownloadingZip ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Archive className="w-5 h-5 mr-2" />
                  )}
                  Download Project ZIP
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Decorative Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden mt-12">
        {phaseConfig.label.split(' ')[0]?.toUpperCase()}
      </div>
    </main>
  );
}
