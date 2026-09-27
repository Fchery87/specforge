import { cn } from "@/lib/utils";
import {
  WORKFLOW_STAGES,
  phaseState,
  stageStatus,
  stageTargetPhase,
  type PhaseId,
  type PhaseRawStatus,
  type PhaseStatusMap,
  type WorkflowStage,
} from "@/lib/workflow";

export type SegmentState = PhaseRawStatus | "now";

/** A phase segment's fill. Ink for done, a part-filled brand track for where the reader is. */
const segmentClass: Record<SegmentState, string> = {
  ready: "bg-ink",
  now: "bg-line",
  generating: "bg-line",
  pending: "bg-line",
  error: "bg-destructive",
  skipped: "border border-dashed border-line-strong bg-transparent",
};

/**
 * The segments of one stage, one per phase. A stage already under way marks its first unfinished
 * phase as `now`, which is where the reader is.
 */
export function StageSegments({
  stage,
  phases,
  skippedPhases = [],
  thin = false,
  className,
}: {
  stage: WorkflowStage;
  phases: PhaseStatusMap;
  skippedPhases?: readonly (PhaseId | string)[];
  thin?: boolean;
  className?: string;
}) {
  const status = stageStatus(stage, phases, skippedPhases);
  const underway = status === "in-progress" || status === "generating";
  const target = stageTargetPhase(stage, phases, skippedPhases);

  return (
    <span
      data-band
      aria-hidden="true"
      className={cn("grid auto-cols-fr grid-flow-col gap-1", className)}
    >
      {stage.phaseIds.map((phaseId) => {
        const raw = phaseState(phases, skippedPhases, phaseId);
        const state: SegmentState = underway && phaseId === target && raw === "pending" ? "now" : raw;

        return (
          <span
            key={phaseId}
            data-phase={phaseId}
            data-state={state}
            className={cn(
              "relative overflow-hidden rounded-full",
              thin ? "h-1" : "h-1.5",
              segmentClass[state]
            )}
          >
            {state === "now" || state === "generating" ? (
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-[45%] rounded-full bg-brand",
                  state === "generating" && "animate-pulse"
                )}
              />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

/** Every stage's segments in one compact band, for a place with no room for labels. */
export function StageBand({
  phases,
  skippedPhases = [],
  className,
}: {
  phases: PhaseStatusMap;
  skippedPhases?: readonly (PhaseId | string)[];
  className?: string;
}) {
  return (
    <span className={cn("grid grid-cols-[2fr_3fr_1fr] gap-2", className)}>
      {WORKFLOW_STAGES.map((stage) => (
        <StageSegments
          key={stage.id}
          stage={stage}
          phases={phases}
          skippedPhases={skippedPhases}
          thin
        />
      ))}
    </span>
  );
}
