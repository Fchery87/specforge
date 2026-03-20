"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useAction, useConvex, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReference } from "convex/server";
import { PhaseStatusIndicator } from "@/components/phase-status";
import { ArtifactPreview } from "@/components/artifact-preview";
import { QuestionsPanel } from "@/components/questions-panel";
import { ArtifactsHeader } from "@/components/artifacts-header";
import { StreamingArtifactPreview } from "@/components/streaming-artifact-preview";
import { ExportOptionsPanel } from "@/components/export-options";
import { SectionPlanPreview, SectionPlanPreviewSkeleton } from "@/components/section-plan-preview";
import { getSectionPlansForPhase } from "@/lib/llm/section-plans";
import type { SectionPlanConfig, UserSectionPreference } from "@/lib/llm/types";
import type { GeneratedSectionPlan } from "@/lib/section-plan-parser";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Loader2, Download, Archive, Sparkles, FileText, Layers, Code, Package } from "lucide-react";
import { toast } from "sonner";
import { getPhaseProgressMessage, getToastMessage } from "@/lib/notifications";
import { PhaseSwitcher } from "@/components/phase-switcher";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TicketBoard } from "@/components/ticket-board";
import { GenerationActivityStream } from "@/components/generation-activity-stream";
import { VerificationPanel } from "@/components/verification-panel";

function toSectionPlanConfig(p: GeneratedSectionPlan): SectionPlanConfig {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    estimatedTokens: p.estimatedTokens,
    required: p.required,
    phaseId: '',
    sectionType: (p.sectionType ?? 'documentation') as SectionPlanConfig['sectionType'],
  };
}

const PHASE_CONFIG: Record<string, { label: string; icon: typeof FileText; description: string }> = {
  constitution: { label: "Constitution", icon: FileText, description: "Immutable truths and core constraints" },
  brief: { label: "Brief", icon: FileText, description: "Define your project scope and goals" },
  prd: { label: "PRD", icon: FileText, description: "Product requirements and user needs" },
  domainModel: { label: "Domain Model", icon: Layers, description: "Entities, rules, and state transitions" },
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
  
  // Interactive section planning state (Phase 4 P2)
  const [showSectionPlan, setShowSectionPlan] = useState(false);
  const [sectionPreferences, setSectionPreferences] = useState<UserSectionPreference[]>([]);
  const staticSectionPlans = getSectionPlansForPhase(phaseId);
  // AI-generated section plans (Task 16)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateSectionPlanAction = (api as any)["actions/generateSectionPlan"]?.generateSectionPlan as any;
  const generateSectionPlanFn = useAction(generateSectionPlanAction);
  const [aiSectionPlans, setAiSectionPlans] = useState<SectionPlanConfig[] | null>(null);
  const [isLoadingAiPlan, setIsLoadingAiPlan] = useState(false);
  const sectionPlans = aiSectionPlans ?? staticSectionPlans;
  
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
  const getAllProjectArtifactsQuery: any = (api as any)?.artifacts?.getAllProjectArtifacts;
  const allArtifacts = useQuery(
    getAllProjectArtifactsQuery,
    isLoaded && isSignedIn && phaseId === "handoff" ? { projectId: projectId as any } : "skip"
  );
  const isGenerating =
    isPhaseStarting || generationTask?.status === "in_progress";
  const hasStreamingPreview =
    !!(streamingArtifact as any)?.streamStatus ||
    !!(streamingArtifact as any)?.previewHtml ||
    !!(streamingArtifact as any)?.content;

  const phaseConfig = PHASE_CONFIG[phaseId] || { label: phaseId, icon: FileText, description: "" };
  const PhaseIcon = phaseConfig.icon;

  // Handle AI plan generation (Task 16)
  async function handleGenerateAiPlan() {
    if (!projectId || !phaseId) return;
    setIsLoadingAiPlan(true);
    try {
      const result = await generateSectionPlanFn({
        projectId: projectId as any,
        phaseId,
      });
      if (result?.sectionPlan?.length) {
        setAiSectionPlans(result.sectionPlan.map(toSectionPlanConfig));
      }
    } catch {
      toast.error("Failed to generate AI plan", {
        description: "Using default section plan instead.",
      });
    } finally {
      setIsLoadingAiPlan(false);
    }
  }

  // Handle initiate generation (shows section plan preview first)
  function handleInitiateGenerate() {
    // Show section plan preview
    setShowSectionPlan(true);
    setSectionPreferences([]);
  }

  // Handle generation with preferences from section plan
  async function handleGenerateWithPreferences(preferences: UserSectionPreference[]) {
    setShowSectionPlan(false);
    setSectionPreferences(preferences);
    
    // TODO: Save preferences to backend
    // await saveSectionPreferences({ projectId, phaseId, preferences });
    
    setIsPhaseStarting(true);
    setPhaseTaskId(null);
    phaseStatusRef.current = null;
    phaseProgressRef.current = null;
    const startToast = getToastMessage("phase_start");
    const toastId = toast.message(startToast.title, {
      description: `${startToast.description} (${preferences.filter(p => p.enabled).length} sections)`,
    });
    phaseToastIdRef.current = toastId;
    try {
      const result = await generatePhase({ 
        projectId: projectId as any, 
        phaseId,
        // TODO: Pass preferences to generation when backend supports it
        // sectionPreferences: preferences,
      });
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
        <div className="flex items-center gap-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: project?.title ?? "Project", href: `/project/${projectId}` },
              { label: phaseConfig.label },
            ]}
          />
          {phases && (
            <PhaseSwitcher
              currentPhaseId={phaseId}
              phases={phases.map(p => ({ phaseId: p.phaseId, status: p.status ?? "pending" }))}
              projectId={projectId}
            />
          )}
        </div>
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
            {showSectionPlan ? (
              <div className="space-y-4">
                {!aiSectionPlans && !isLoadingAiPlan && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAiPlan}
                      disabled={isGenerating || isLoadingAiPlan}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Plan with AI
                    </Button>
                  </div>
                )}
                <SectionPlanPreview
                  phaseId={phaseId}
                  phaseName={phaseConfig.label}
                  sectionPlans={sectionPlans}
                  onGenerate={handleGenerateWithPreferences}
                  isGenerating={isGenerating}
                  isLoadingPlan={isLoadingAiPlan}
                />
              </div>
            ) : (
              <QuestionsPanel
                projectId={projectId}
                phaseId={phaseId}
                questions={phase.questions}
                onGeneratePhase={handleInitiateGenerate}
                isGenerating={isGenerating}
                onCancelGeneration={handleCancelGeneration}
                isCancelling={isCancelling}
              />
            )}
          </div>

          {/* Right Column: Artifacts */}
          <div>
            <ArtifactsHeader
              streamStatus={(streamingArtifact as any)?.streamStatus}
              hasArtifacts={!!phase.artifacts && phase.artifacts.length > 0}
              onDownloadAll={handleDownloadZip}
              isDownloading={isDownloadingZip}
            />

            {isGenerating && (
              <div className="mb-4">
                <GenerationActivityStream
                  activities={generationTask?.activityLog ?? []}
                  isActive={isGenerating}
                />
              </div>
            )}

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
                      onCancel={handleCancelGeneration}
                      isCancelling={isCancelling}
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

            {/* Export options for handoff phase */}
            {phaseId === "handoff" && project && (
              <ExportOptionsPanel
                project={{
                  _id: project._id,
                  title: project.title,
                  description: project.description,
                  createdAt: project.createdAt,
                  zipStorageId: project.zipStorageId,
                }}
                artifacts={{
                  brief: allArtifacts?.find((a: any) => a.type === "brief")?.content,
                  constitution: allArtifacts?.find((a: any) => a.type === "constitution")?.content,
                  prd: allArtifacts?.find((a: any) => a.type === "prd")?.content,
                  techSpec: allArtifacts?.find((a: any) => a.type === "techSpec")?.content,
                  userStories: allArtifacts?.find((a: any) => a.type === "userStories")?.content,
                  handoff: allArtifacts?.find((a: any) => a.type === "handoff")?.content,
                }}
                onDownloadZip={handleDownloadZip}
                isDownloadingZip={isDownloadingZip}
              />
            )}
          </div>
        </div>
      </section>

      {/* Ticket Board — only for stories phase */}
      {phaseId === 'stories' && (
        <section className="page-container page-section border-t-2 border-border relative z-10">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-6">
            Ticket Board
          </h2>
          <TicketBoard
            projectId={projectId as unknown as Id<"projects">}
            phaseId={phaseId}
            artifactId={phase.artifacts?.[0]?._id}
          />
        </section>
      )}

      {/* Verification Panel — for specs and stories phases */}
      {(phaseId === 'specs' || phaseId === 'stories') && (
        <section className="page-container page-section border-t-2 border-border relative z-10">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-6">
            Verification
          </h2>
          <div className="max-w-2xl">
            <VerificationPanel
              projectId={projectId}
              phaseId={phaseId}
            />
          </div>
        </section>
      )}

      {/* Decorative Element */}
      <div className="text-[15vw] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none overflow-hidden mt-12">
        {phaseConfig.label.split(' ')[0]?.toUpperCase()}
      </div>
    </main>
  );
}
