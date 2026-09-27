"use client";

import Link from "next/link";
import { Check, Loader2, AlertCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageQualityFlag } from "@/lib/quality/stage-report";
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
  /**
   * The requirement-quality counts per stage id, from `getProjectStageQuality`.
   *
   * Optional, so a caller with no report to show renders the map exactly as it did before. The counts
   * come from the same computation the artifact's report uses, so the word here and the lines there
   * cannot disagree.
   */
  quality?: Readonly<Record<string, StageQualityFlag>>;
  className?: string;
}

const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  generating: "Generating",
  ready: "Ready",
  error: "Error",
};

/** `criterion` takes a singular, which "1 criteria" would get wrong. */
function criterionNoun(count: number): string {
  return count === 1 ? "criterion" : "criteria";
}

/**
 * The gap a stage carries, as words.
 *
 * A word rather than a second colour, because the document language says a status is readable without
 * separating the tones. `unclassified` is absent: a criterion written before the class existed was
 * never judged, so counting it would call it untestable. Every count at zero yields no words at all,
 * which leaves the status text exactly as it was.
 */
function qualityWords(flag: StageQualityFlag | undefined): string[] {
  if (!flag) return [];

  const words: string[] = [];

  if (flag.untraced > 0) {
    words.push(
      `${flag.untraced} requirement${flag.untraced === 1 ? "" : "s"} untraced`
    );
  }
  if (flag.unobservable > 0) {
    words.push(`${flag.unobservable} ${criterionNoun(flag.unobservable)} not testable`);
  }
  if (flag.vague > 0) {
    words.push(`${flag.vague} ${criterionNoun(flag.vague)} vague`);
  }

  return words;
}

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
  quality,
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
        const gapWords = qualityWords(quality?.[stage.id]);
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
                {/* No `truncate` here: the gap is the reason to look at the stage, so it wraps rather
                    than being clipped at the width of the card. */}
                <span className="text-caption text-muted-foreground">
                  {STAGE_STATUS_LABELS[status]}
                  {gapWords.length > 0 ? `, ${gapWords.join(", ")}` : null}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
