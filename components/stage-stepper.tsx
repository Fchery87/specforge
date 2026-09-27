"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { StageSegments } from "@/components/stage-band";
import type { StageQualityFlag } from "@/lib/quality/stage-report";
import {
  WORKFLOW_STAGES,
  stageStatus,
  stageTargetPhase,
  type PhaseId,
  type PhaseStatusMap,
  type StageStatus,
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

/** Label tone: a stage under way reads as the one you are in. */
const labelTone: Record<StageStatus, string> = {
  "not-started": "text-dim",
  "in-progress": "text-ink",
  generating: "text-ink",
  ready: "text-ink",
  error: "text-ink",
};

/**
 * The map of the workflow, drawn as a band. Each stage is one link and one column, as wide as its
 * phase count, with a segment per phase. The segments are decoration for sighted readers; the link's
 * accessible name stays the stage, its status and its gap.
 */
export function StageStepper({
  projectId,
  currentPhase,
  phases,
  skippedPhases = [],
  quality,
  className,
}: StageStepperProps) {
  const skipped = skippedPhases as readonly PhaseId[];

  return (
    <nav
      aria-label="Workflow stages"
      className={cn("grid w-full grid-cols-1 gap-5 sm:grid-cols-[2fr_3fr_1fr] sm:gap-3", className)}
    >
      {WORKFLOW_STAGES.map((stage) => {
        const status = stageStatus(stage, phases, skipped);
        const targetPhase = stageTargetPhase(stage, phases, skipped);
        const gapWords = qualityWords(quality?.[stage.id]);
        const underway = status === "in-progress" || status === "generating";
        const isHighlighted =
          currentPhase !== "constitution" &&
          Boolean(currentPhase) &&
          stage.phaseIds.includes(currentPhase as PhaseId);

        return (
          <Link
            key={stage.id}
            data-stage={stage.id}
            href={`/project/${projectId}/phase/${targetPhase}`}
            aria-current={isHighlighted ? "step" : undefined}
            className="group flex min-w-0 flex-col gap-2.5 rounded-sm py-1 focus-ring"
          >
            <StageSegments stage={stage} phases={phases} skippedPhases={skipped} />

            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "truncate text-ui",
                  isHighlighted || underway ? "font-semibold" : "font-medium",
                  isHighlighted ? "text-ink" : labelTone[status]
                )}
              >
                {stage.label}
              </span>
              {/* No `truncate` here: the gap is the reason to look at the stage, so it wraps rather
                  than being clipped at the width of the column. */}
              <span
                className={cn(
                  "text-caption",
                  status === "error" ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {STAGE_STATUS_LABELS[status]}
                {gapWords.length > 0 ? `, ${gapWords.join(", ")}` : null}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
