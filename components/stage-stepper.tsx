"use client";

import Link from "next/link";
import { Check, Loader2, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WORKFLOW_STAGES,
  stageStatus,
  type PhaseId,
  type PhaseStatusMap,
  type StageStatus,
  type WorkflowStage,
} from "@/lib/workflow";

export interface StageStepperProps {
  projectId: string;
  currentPhase?: PhaseId | string;
  phases: PhaseStatusMap;
  skippedPhases?: readonly (PhaseId | string)[];
  className?: string;
}

const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  generating: "Generating",
  ready: "Ready",
  error: "Error",
};

function getStageTargetPhase(
  stage: WorkflowStage,
  phases: PhaseStatusMap,
  skippedPhases: readonly (PhaseId | string)[] = [],
): PhaseId {
  const isPhaseSkipped = (id: PhaseId): boolean => {
    if (skippedPhases.includes(id)) return true;
    if (Array.isArray(phases)) {
      const item = phases.find((p) => p.phaseId === id);
      return item?.status === "skipped";
    }
    if (phases instanceof Map) {
      const val = phases.get(id);
      return typeof val === "string" ? val === "skipped" : val?.status === "skipped";
    }
    if (phases && typeof phases === "object") {
      const val = (phases as Record<string, unknown>)[id];
      if (typeof val === "string") return val === "skipped";
      if (val && typeof val === "object" && "status" in val) {
        return (val as { status: string }).status === "skipped";
      }
    }
    return false;
  };

  const getPhaseStatus = (id: PhaseId): string | undefined => {
    if (Array.isArray(phases)) {
      return phases.find((p) => p.phaseId === id)?.status;
    }
    if (phases instanceof Map) {
      const val = phases.get(id);
      return typeof val === "string" ? val : val?.status;
    }
    if (phases && typeof phases === "object") {
      const val = (phases as Record<string, unknown>)[id];
      if (typeof val === "string") return val;
      if (val && typeof val === "object" && "status" in val) {
        return (val as { status: string }).status;
      }
    }
    return undefined;
  };

  const enabledPhaseIds = stage.phaseIds.filter((id) => !isPhaseSkipped(id));
  if (enabledPhaseIds.length === 0) {
    return stage.phaseIds[0];
  }

  const notReadyPhase = enabledPhaseIds.find((id) => getPhaseStatus(id) !== "ready");
  return notReadyPhase ?? enabledPhaseIds[0];
}

export function StageStepper({
  projectId,
  currentPhase,
  phases,
  skippedPhases = [],
  className,
}: StageStepperProps) {
  return (
    <nav
      aria-label="Workflow stages"
      className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3 w-full", className)}
    >
      {WORKFLOW_STAGES.map((stage, idx) => {
        const status = stageStatus(stage, phases, skippedPhases as readonly PhaseId[]);
        const targetPhase = getStageTargetPhase(stage, phases, skippedPhases);
        const isHighlighted =
          currentPhase !== "constitution" &&
          Boolean(currentPhase) &&
          stage.phaseIds.includes(currentPhase as PhaseId);

        return (
          <Link
            key={stage.id}
            href={`/project/${projectId}/phase/${targetPhase}`}
            aria-current={isHighlighted ? "step" : undefined}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3 border transition-colors duration-(--duration-standard)",
              "focus-ring min-w-0 rounded-sm",
              isHighlighted
                ? "border-primary bg-primary/10"
                : "border-line bg-surface hover:border-primary/50 hover:bg-raised/30",
              status === "ready" && !isHighlighted && "border-success/40",
              status === "error" && !isHighlighted && "border-destructive/40"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "size-6 shrink-0 flex items-center justify-center border transition-colors",
                  status === "ready" && "bg-success border-success text-void",
                  status === "generating" && "border-warning bg-warning/20 text-amber",
                  status === "error" && "border-destructive bg-destructive/20 text-destructive",
                  status === "in-progress" && "border-primary bg-primary/20 text-primary",
                  status === "not-started" && "border-line bg-raised/30 text-muted-foreground"
                )}
                aria-hidden
              >
                {status === "ready" ? (
                  <Check className="size-3.5" />
                ) : status === "generating" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : status === "error" ? (
                  <AlertCircle className="size-3.5" />
                ) : status === "in-progress" ? (
                  <Circle className="size-2.5 fill-current" />
                ) : (
                  <span className="text-caption font-semibold">{idx + 1}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "text-ui font-semibold truncate",
                    isHighlighted ? "text-ink font-bold" : "text-ink/90"
                  )}
                >
                  {stage.label}
                </span>
                <span className="text-caption text-muted-foreground truncate">
                  {STAGE_STATUS_LABELS[status]}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
