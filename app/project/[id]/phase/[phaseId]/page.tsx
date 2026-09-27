"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useAction, useConvex, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReference } from "convex/server";
import { generatePhaseAction, resumePhaseAction, generateProjectZipAction, generateSectionPlanAction, getGenerationTaskAction, getArtifactByPhaseAction, getAllProjectArtifactsAction, cancelArtifactStreamingAction } from "@/lib/convex-actions";
import { ArtifactPreview } from "@/components/artifact-preview";
import { QuestionsPanel } from "@/components/questions-panel";
import type { GrillSessionData } from "@/components/stress-test-modal";
import { ArtifactsHeader } from "@/components/artifacts-header";
import { StreamingArtifactPreview } from "@/components/streaming-artifact-preview";
import { ExportOptionsPanel } from "@/components/export-options";
import { SectionPlanPreview, SectionPlanPreviewSkeleton } from "@/components/section-plan-preview";
import { getSectionPlansForPhase } from "@/lib/llm/section-plans";
import type { SectionPlanConfig, UserSectionPreference } from "@/lib/llm/types";
import type { GeneratedSectionPlan } from "@/lib/section-plan-parser";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Sparkles, FileText, Layers, Code, Package, BookOpen, Target, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { getPhaseProgressMessage, getToastMessage } from "@/lib/notifications";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TicketBoard } from "@/components/ticket-board";
import { GenerationActivityStream } from "@/components/generation-activity-stream";
import { VerificationPanel } from "@/components/verification-panel";
import { EvidenceReviewPanel } from "@/components/evidence-review-panel";
import { GenerationReadinessBanner } from "@/components/generation-readiness-banner";
import { StageStepper } from "@/components/stage-stepper";
import { NextActionButton } from "@/components/next-action-button";
import { AddSectionMenu } from "@/components/add-section-menu";
import { StagePhaseLinks } from "@/components/stage-phase-links";
import { nextAction, MODE_POLICIES, type PhaseId, type ProjectMode } from "@/lib/workflow";


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
  constitution: { label: "Project Rules", icon: FileText, description: "Core invariants, non-goals, and architectural boundaries" },
  brief: { label: "Brief", icon: BookOpen, description: "Project scope, user personas, and initial evidence baseline" },
  prd: { label: "PRD", icon: Target, description: "Evidence-backed requirements with stable claim IDs" },
  domainModel: { label: "Domain Model", icon: Layers, description: "Entities, invariant rules, and state transitions" },
  specs: { label: "Architecture", icon: Code, description: "Deep interface contracts, explicit test seams, and architecture" },
  stories: { label: "Tasks", icon: ClipboardList, description: "Vertical tracer bullets with blocking dependency graphs" },
  artifacts: { label: "Schemas", icon: Sparkles, description: "Live schema validation, in-browser editor, and code models" },
  handoff: { label: "Export", icon: Package, description: "Agent-native bundle, SKILL.md, and verified requirement traceability" },
};

export default function PhasePage() {
  const params = useParams<{ id: string; phaseId: string }>();
  const projectId = params.id as Id<"projects">;
  const phaseId = params.phaseId;
  const { isLoaded, isSignedIn } = useAuth();

  const project = useQuery(
    api.projects.getProject,
    isLoaded && isSignedIn ? { projectId } : "skip"
  );
  const phase = useQuery(
    api.projects.getPhase,
    isLoaded && isSignedIn ? { projectId, phaseId } : "skip"
  );
  const phases = useQuery(
    api.projects.getProjectPhases,
    isLoaded && isSignedIn ? { projectId } : "skip"
  );
  const readiness = useQuery(api.userConfigs.getGenerationReadiness);
  const stageQuality = useQuery(
    api.stageReports.getProjectStageQuality,
    isLoaded && isSignedIn ? { projectId } : "skip"
  );
  const generatePhase = useAction(generatePhaseAction);

  const resumePhase = useAction(resumePhaseAction);
  const generateZip = useAction(generateProjectZipAction);
  const cancelArtifactStreaming = useMutation(cancelArtifactStreamingAction);
  const toggleSkip = useMutation(api.projects.toggleSkipPhase);
  const getGenerationTaskQuery = getGenerationTaskAction;
  const convex = useConvex();
  const [isPhaseStarting, setIsPhaseStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [phaseTaskId, setPhaseTaskId] = useState<string | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  
  // Interactive section planning state (Phase 4 P2)
  const [showSectionPlan, setShowSectionPlan] = useState(false);
  const staticSectionPlans = getSectionPlansForPhase(phaseId);
  // AI-generated section plans (Task 16)
  const generateSectionPlanFn = useAction(generateSectionPlanAction);
  const [aiSectionPlans, setAiSectionPlans] = useState<SectionPlanConfig[] | null>(null);
  const [isLoadingAiPlan, setIsLoadingAiPlan] = useState(false);
  const sectionPlans = aiSectionPlans ?? staticSectionPlans;
  
  const phaseToastIdRef = useRef<string | number | null>(null);
  const phaseStatusRef = useRef<string | null>(null);
  const phaseProgressRef = useRef<number | null>(null);
  const generationTask = useQuery(
    getGenerationTaskQuery,
    phaseTaskId ? { taskId: phaseTaskId as Id<'generationTasks'> } : "skip"
  );
  const streamingArtifact = useQuery(
    getArtifactByPhaseAction,
    isLoaded && isSignedIn ? { projectId, phaseId } : "skip"
  );
  const allArtifacts = useQuery(
    getAllProjectArtifactsAction,
    isLoaded && isSignedIn && phaseId === "handoff" ? { projectId } : "skip"
  );
  const isGenerating =
    isPhaseStarting || generationTask?.status === "in_progress";
  const isStreamingActive =
    isGenerating ||
    streamingArtifact?.streamStatus === "streaming" ||
    streamingArtifact?.streamStatus === "paused";
  const isStreamingCancelled =
    streamingArtifact?.streamStatus === "cancelled";
  const showStreamingPreview =
    isStreamingActive || isStreamingCancelled;

  const phaseConfig = PHASE_CONFIG[phaseId] || { label: phaseId, icon: FileText, description: "" };
  const isSkipped = project?.skippedPhases?.includes(phaseId) ?? false;
  const currentMode = (project?.mode ?? "full") as ProjectMode;
  const nextActionItem = project
    ? nextAction(phases ?? [], (project.skippedPhases ?? []) as readonly PhaseId[], currentMode)
    : null;

  // Handle AI plan generation (Task 16)
  async function handleGenerateAiPlan() {
    if (!projectId || !phaseId) return;
    setIsLoadingAiPlan(true);
    try {
      const result = await generateSectionPlanFn({
        projectId,
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
  }

  // Handle generation with preferences from section plan
  async function handleGenerateWithPreferences(preferences: UserSectionPreference[]) {
    setShowSectionPlan(false);
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
        projectId, 
        phaseId,
        sectionPreferences: preferences,
      });
      setPhaseTaskId(result?.taskId ?? null);
      if (!result?.taskId) {
        throw new Error("Phase generation did not return a task id.");
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
      await cancelArtifactStreaming({ projectId, phaseId });
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

  const canResume =
    generationTask !== undefined &&
    generationTask !== null &&
    generationTask.status === "failed" &&
    (generationTask.currentStep ?? 0) > 0 &&
    (generationTask.currentStep ?? 0) < (generationTask.totalSteps ?? 1);

  async function handleResumePhase() {
    if (!generationTask?._id) return;
    setIsPhaseStarting(true);
    toast.info(`Resuming generation from step ${(generationTask.currentStep ?? 0) + 1}...`);
    try {
      await resumePhase({ taskId: generationTask._id });
    } catch (error) {
      setIsPhaseStarting(false);
      toast.error("Failed to resume generation", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
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
        await generateZip({ projectId });
      }

      const zipUrl = await convex.query(api.projects.getProjectZipUrl, {
        projectId,
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
      <main className="min-h-[calc(100vh-var(--header-height))]">
        <div className="page-container py-6">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="page-container">
          <div className="mb-10">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-16 w-2/3 mb-4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          <div className="flex flex-col gap-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-var(--header-height))]">
      {/* Back Navigation */}
      <div className="page-container py-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: project?.title ?? "Project", href: `/project/${projectId}` },
            { label: phaseId === "constitution" ? "Project Rules" : phaseConfig.label },
          ]}
        />
      </div>

      {/* Stage Stepper (above the title/phase header) */}
      <section className="page-container pb-6">
        <StageStepper
          projectId={projectId}
          currentPhase={phaseId}
          phases={phases ?? []}
          skippedPhases={project?.skippedPhases ?? []}
          quality={stageQuality}
        />
      </section>

      {/* Phase Header */}
      <section className="page-container pb-8">
        <p className="text-label text-dim">
          {phaseId === "constitution" ? project.title : phaseConfig.label}
        </p>
        <h1 className="mt-2 text-heading font-medium text-ink">
          {phaseId === "constitution" ? "Project Rules" : project.title}
        </h1>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-muted-foreground">
          {phaseConfig.description}
        </p>
      </section>

      {/* One next action, under the stepper */}
      {nextActionItem || (project.skippedPhases ?? []).length > 0 ? (
        <section className="page-container pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <StagePhaseLinks
                projectId={projectId}
                currentPhase={phaseId}
                skippedPhases={project.skippedPhases ?? []}
              />
              <AddSectionMenu
                skippedPhases={project.skippedPhases ?? []}
                onEnable={async (phaseToEnable) => {
                  try {
                    await toggleSkip({ projectId, phaseId: phaseToEnable, skip: false });
                    toast.success(`Enabled ${PHASE_CONFIG[phaseToEnable]?.label ?? phaseToEnable}`);
                  } catch {
                    toast.error("Failed to enable section");
                  }
                }}
              />
            </div>
            {nextActionItem && (
              <div className="ml-auto shrink-0">
                <NextActionButton
                  projectId={projectId}
                  action={nextActionItem}
                  skippedPhases={project?.skippedPhases ?? []}
                />
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Generation Readiness Banner */}
      <section className={readiness?.ready === false ? "page-container pb-6" : undefined}>
        <GenerationReadinessBanner ready={readiness?.ready ?? true} />
      </section>

      {/* Skipped Phase Banner */}
      {isSkipped && (
        <section className="page-container pb-6">

          <div className="flex flex-col justify-between gap-4 rounded-lg border border-amber/40 bg-amber/10 p-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-label text-amber">
                  Skipped phase
                </span>
                {project?.mode && (
                  <span className="text-caption text-dim">
                    ({MODE_POLICIES[project.mode as ProjectMode]?.label ?? 'Custom Workflow'})
                  </span>
                )}
              </div>
              <p className="text-ui text-muted-foreground">
                This phase is skipped in your current project workflow. You can enable it anytime to answer questions and generate its artifact.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await toggleSkip({ projectId, phaseId, skip: false });
                  toast.success(`Enabled ${phaseConfig.label} phase`);
                } catch {
                  toast.error(`Failed to enable ${phaseConfig.label}`);
                }
              }}
              className="shrink-0 self-start border-amber/40 hover:bg-amber/20 sm:self-auto"
            >
              Enable this phase
            </Button>
          </div>
        </section>
      )}

      {/* Main Content Grid */}
      <section className="page-container page-section border-t border-line">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
          {/* Left Column: Questions */}
          <div className="min-w-0">
            <h2 className="mb-6 text-title font-medium text-ink">
              Clarifications
            </h2>
            {showSectionPlan ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSectionPlan(false)}
                    disabled={isGenerating}
                  >
                    Back to questions
                  </Button>
                  {!aiSectionPlans && !isLoadingAiPlan && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAiPlan}
                      disabled={isGenerating || isLoadingAiPlan}
                    >
                      <Sparkles aria-hidden className="size-3.5" />
                      Generate plan with AI
                    </Button>
                  )}
                </div>
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
                grillSession={'grillSession' in phase && phase.grillSession ? (phase.grillSession as unknown as GrillSessionData) : undefined}
                onGeneratePhase={handleInitiateGenerate}
                isGenerating={isGenerating}
                onCancelGeneration={handleCancelGeneration}
                isCancelling={isCancelling}
                canResume={canResume}
                onResumePhase={handleResumePhase}
              />
            )}
          </div>

          {/* Right Column: the reading surface */}
          <div className="min-w-0">
            <ArtifactsHeader
              streamStatus={streamingArtifact?.streamStatus}
              hasArtifacts={!!phase.artifacts && phase.artifacts.length > 0}
              onDownloadAll={handleDownloadZip}
              isDownloading={isDownloadingZip}
            />

            {isGenerating && (
              <div className="mb-6">
                <GenerationActivityStream
                  activities={generationTask?.activityLog ?? []}
                  isActive={isGenerating}
                />
              </div>
            )}

            {showStreamingPreview ? (
              <StreamingArtifactPreview
                title={streamingArtifact?.title ?? "Generating…"}
                previewHtml={streamingArtifact?.previewHtml ?? ""}
                streamStatus={streamingArtifact?.streamStatus ?? (isGenerating ? "streaming" : undefined)}
                currentSection={streamingArtifact?.currentSection}
                sectionsCompleted={streamingArtifact?.sectionsCompleted}
                sectionsTotal={streamingArtifact?.sectionsTotal}
                onCancel={handleCancelGeneration}
                isCancelling={isCancelling}
              />
            ) : (phase.artifacts ?? []).length > 0 ? (
              <div className="flex flex-col gap-14">
                {phase.artifacts.map((a) => (
                  <div key={a._id} className="flex flex-col gap-8">
                    <ArtifactPreview artifact={a} projectId={projectId} />
                    <EvidenceReviewPanel projectId={projectId} artifactId={a._id} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                variant="inbox"
                title="No artifacts yet"
                description="Answer the interview questions or complete stress-test grilling to generate verified artifacts."
                className="py-12"
              />
            )}

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
            )}
          </div>
        </div>
      </section>

      {/* Ticket Board for stories phase */}
      {phaseId === 'stories' && (
        <section className="page-container page-section border-t border-line">
          <h2 className="mb-6 text-title font-medium text-ink">
            Ticket board and tracer bullets
          </h2>
          <TicketBoard
            projectId={projectId}
            phaseId={phaseId}
            artifactId={phase.artifacts?.[0]?._id}
          />
        </section>
      )}

      {/* Verification Panel for specs and stories phases */}
      {(phaseId === 'specs' || phaseId === 'stories') && (
        <section className="page-container page-section border-t border-line">
          <h2 className="mb-6 text-title font-medium text-ink">
            Implementation verification
          </h2>
          <div className="max-w-2xl">
            <VerificationPanel
              projectId={projectId}
              phaseId={phaseId}
            />
          </div>
        </section>
      )}
    </main>
  );
}
