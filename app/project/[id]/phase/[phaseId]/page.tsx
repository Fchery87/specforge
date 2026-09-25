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
import { PhaseStatusIndicator } from "@/components/phase-status";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Loader2, Download, Archive, Sparkles, FileText, Layers, Code, Package, BookOpen, Target, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { getPhaseProgressMessage, getToastMessage } from "@/lib/notifications";
import { PhaseSwitcher } from "@/components/phase-switcher";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { TicketBoard } from "@/components/ticket-board";
import { GenerationActivityStream } from "@/components/generation-activity-stream";
import { VerificationPanel } from "@/components/verification-panel";
import { EvidenceReviewPanel } from "@/components/evidence-review-panel";

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
  constitution: { label: "Constitution", icon: FileText, description: "Core invariants, non-goals, and architectural boundaries" },
  brief: { label: "Brief", icon: BookOpen, description: "Project scope, user personas, and initial evidence baseline" },
  prd: { label: "PRD", icon: Target, description: "Evidence-backed requirements with stable claim IDs" },
  domainModel: { label: "Domain Model", icon: Layers, description: "Entities, invariant rules, and state transitions" },
  specs: { label: "Specifications", icon: Code, description: "Deep interface contracts, explicit test seams, and architecture" },
  stories: { label: "User Stories", icon: ClipboardList, description: "Vertical tracer bullets with blocking dependency graphs" },
  artifacts: { label: "Artifacts", icon: Sparkles, description: "Live schema validation, in-browser editor, and code models" },
  handoff: { label: "Handoff", icon: Package, description: "Agent-native bundle, SKILL.md, and verified requirement traceability" },
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
  const hasStreamingPreview =
    !!streamingArtifact?.streamStatus ||
    !!streamingArtifact?.previewHtml ||
    !!streamingArtifact?.content;

  const phaseConfig = PHASE_CONFIG[phaseId] || { label: phaseId, icon: FileText, description: "" };
  const PhaseIcon = phaseConfig.icon;
  const isSkipped = project?.skippedPhases?.includes(phaseId) ?? false;

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
        <div className="flex flex-wrap items-center justify-between gap-4">
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
              phases={phases.map(p => ({
                phaseId: p.phaseId,
                status: project?.skippedPhases?.includes(p.phaseId) ? "skipped" : (p.status ?? "pending"),
              }))}
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

      {/* Skipped Phase Banner */}
      {isSkipped && (
        <section className="page-container pb-6 relative z-10">
          <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Skipped Phase
                </span>
                {project?.mode && (
                  <span className="text-xs text-muted-foreground">
                    ({project.mode === 'quick' ? 'Quick Feature Spec' : project.mode === 'backend' ? 'API & Backend Service' : 'Custom Workflow'})
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground/80">
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
              className="border-amber-500/40 hover:bg-amber-500/20 shrink-0 self-start sm:self-auto"
            >
              Enable This Phase
            </Button>
          </div>
        </section>
      )}

      {/* Phase Status Indicator */}
      <section className="page-container pb-8 relative z-10">
        <PhaseStatusIndicator
          phases={(phases ?? []).map(p => ({
            ...p,
            status: project?.skippedPhases?.includes(p.phaseId) ? "skipped" : (p.status ?? "pending"),
          }))}
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
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSectionPlan(false)}
                    disabled={isGenerating}
                  >
                    ← Back to questions
                  </Button>
                  {!aiSectionPlans && !isLoadingAiPlan && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAiPlan}
                      disabled={isGenerating || isLoadingAiPlan}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Plan with AI
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

          {/* Right Column: Artifacts */}
          <div>
            <ArtifactsHeader
              streamStatus={streamingArtifact?.streamStatus}
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
                      title={streamingArtifact?.title ?? "Generating…"}
                      previewHtml={streamingArtifact?.previewHtml ?? ""}
              streamStatus={streamingArtifact?.streamStatus}
                      currentSection={streamingArtifact?.currentSection}
                      sectionsCompleted={streamingArtifact?.sectionsCompleted}
                      sectionsTotal={streamingArtifact?.sectionsTotal}
                      onCancel={handleCancelGeneration}
                      isCancelling={isCancelling}
                    />
                  </div>
                )}
                {(phase.artifacts ?? []).length > 0 ? (
                  <div className="space-y-4">
                    {phase.artifacts.map((a) => (
                      <div key={a._id}>
                        <ArtifactPreview
                          artifact={a}
                          projectId={projectId}
                          onDelete={() => {}}
                        />
                        <EvidenceReviewPanel projectId={projectId} artifactId={a._id} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    variant="inbox"
                    title="No Artifacts Yet"
                    description="Answer the interview questions or complete stress-test grilling to generate verified artifacts."
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
        <section className="page-container page-section border-t-2 border-border relative z-10">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-6">
            Ticket Board & Tracer Bullets
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
        <section className="page-container page-section border-t-2 border-border relative z-10">
          <h2 className="text-v-h3 font-bold uppercase tracking-tighter mb-6">
            Implementation Verification
          </h2>
          <div className="max-w-2xl">
            <VerificationPanel
              projectId={projectId}
              phaseId={phaseId}
            />
          </div>
        </section>
      )}

      {/* Decorative Watermark */}
      <div className="max-w-full overflow-hidden text-[clamp(2.5rem,10vw,7.5rem)] font-bold leading-none text-muted opacity-5 text-center pointer-events-none select-none truncate mt-12">
        {phaseConfig.label.split(' ')[0]?.toUpperCase()}
      </div>
    </main>
  );
}
