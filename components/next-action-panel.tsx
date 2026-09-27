import { cn } from "@/lib/utils";
import type { StageQualityFlag } from "@/lib/quality/stage-report";
import {
  WORKFLOW_STAGES,
  phaseLabel,
  type NextAction,
  type PhaseId,
} from "@/lib/workflow";
import { NextActionButton } from "@/components/next-action-button";

type QualityByStage = Readonly<Record<string, StageQualityFlag>>;

function stageLabel(stageId: string): string {
  return WORKFLOW_STAGES.find((stage) => stage.id === stageId)?.label ?? stageId;
}

/**
 * What the next step is and why, in words. A stage under review with untraced claims names them,
 * because those claims are what stands between the reader and the next stage.
 */
export function nextActionCopy(
  action: NextAction,
  quality: QualityByStage = {}
): { title: string; reason: string } {
  switch (action.kind) {
    case "answer":
      return {
        title: `Answer the ${phaseLabel(action.phaseId)} questions`,
        reason:
          "SpecForge asks what it needs before it writes. Your answers become the evidence behind each claim.",
      };
    case "generate":
      return {
        title: `Generate the ${phaseLabel(action.phaseId)}`,
        reason: "The questions are answered. Generate the draft, then review its claims.",
      };
    case "review": {
      const untraced = quality[action.stageId]?.untraced ?? 0;
      const stage = stageLabel(action.stageId);
      if (untraced > 0) {
        return {
          title: `Settle ${untraced} untraced ${untraced === 1 ? "claim" : "claims"} in ${stage}`,
          reason:
            "These claims have no evidence yet. Settle them before the next stage builds on them.",
        };
      }
      return {
        title: `Review ${stage}`,
        reason: "Every phase in this stage has a draft. Read it and confirm its claims before moving on.",
      };
    }
    case "continue":
      return {
        title: `Continue to ${stageLabel(action.stageId)}`,
        reason: "The previous stage is reviewed. The next one starts from its confirmed claims.",
      };
    case "export":
      return {
        title: "Export the handoff pack",
        reason:
          "Every stage is ready. Export the spec, the project rules and the build guide for your coding agent.",
      };
  }
}

/** The one instruction on the project page: what to do next, why, and the control that does it. */
export function NextActionPanel({
  projectId,
  action,
  skippedPhases = [],
  quality,
  className,
}: {
  projectId: string;
  action: NextAction;
  skippedPhases?: readonly (PhaseId | string)[];
  quality?: QualityByStage;
  className?: string;
}) {
  const { title, reason } = nextActionCopy(action, quality);

  return (
    <section
      aria-label="Next step"
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-4 rounded-sm border border-line bg-void px-5 py-4",
        "md:grid-cols-[auto_minmax(0,1fr)_auto]",
        className
      )}
    >
      <span aria-hidden className="size-2.5 rounded-full bg-brand ring-4 ring-brand/20" />
      <div className="min-w-0">
        <p className="text-label text-dim">Next</p>
        <p className="text-body font-semibold text-ink">{title}</p>
        <p className="mt-0.5 max-w-[72ch] text-ui text-muted-foreground">{reason}</p>
      </div>
      <NextActionButton
        projectId={projectId}
        action={action}
        skippedPhases={skippedPhases}
        className="col-span-2 md:col-span-1"
      />
    </section>
  );
}
