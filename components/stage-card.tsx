"use client";

import * as React from "react";
import { Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NextActionButton } from "@/components/next-action-button";
import { PHASE_TAB_LABELS } from "@/components/stage-tabs";
import {
  stageStatus,
  nextAction,
  type PhaseId,
  type PhaseStatusMap,
  type StageStatus,
  type WorkflowStage,
  type ProjectMode,
  type NextAction,
} from "@/lib/workflow";

export interface StageCardProps {
  projectId: string;
  stage: WorkflowStage;
  phases: PhaseStatusMap;
  skippedPhases?: readonly (PhaseId | string)[];
  mode?: ProjectMode;
  action?: NextAction;
  onToggleSkip?: (phaseId: PhaseId | string, skip: boolean) => void;
  className?: string;
}

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  generating: "Generating",
  ready: "Ready",
  error: "Error",
};

export function StageCard({
  projectId,
  stage,
  phases,
  skippedPhases = [],
  mode = "full",
  action,
  onToggleSkip,
  className,
}: StageCardProps) {
  const status = stageStatus(stage, phases, skippedPhases as readonly PhaseId[]);

  const isPhaseSkipped = React.useCallback(
    (id: PhaseId): boolean => {
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
    },
    [phases, skippedPhases]
  );

  const enabledPhaseIds = stage.phaseIds.filter((id) => !isPhaseSkipped(id));
  const skippedStagePhases = stage.phaseIds.filter((id) => isPhaseSkipped(id));

  // Determine the next action for this specific stage
  const resolvedAction: NextAction = React.useMemo(() => {
    if (action) return action;

    if (status === "ready") {
      return { kind: "review", stageId: stage.id };
    }

    const projectAction = nextAction(phases, skippedPhases as readonly PhaseId[], mode);
    if (
      (projectAction.kind === "continue" && projectAction.stageId === stage.id) ||
      (projectAction.kind === "review" && projectAction.stageId === stage.id) ||
      ("phaseId" in projectAction && stage.phaseIds.includes(projectAction.phaseId))
    ) {
      return projectAction;
    }

    const targetPhase = enabledPhaseIds[0] ?? stage.phaseIds[0];
    return { kind: "answer", phaseId: targetPhase };
  }, [action, status, stage, phases, skippedPhases, mode, enabledPhaseIds]);

  return (
    <Card
      className={cn(
        "flex flex-col justify-between border-2 transition-all duration-200",
        status === "ready" && "border-emerald-500/30",
        status === "in-progress" && "border-primary/40",
        status === "error" && "border-destructive/40",
        className
      )}
    >
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Stage
          </span>
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full border",
              status === "ready" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
              status === "in-progress" && "bg-primary/10 text-primary border-primary/30",
              status === "generating" && "bg-amber-500/10 text-amber-500 border-amber-500/30",
              status === "error" && "bg-destructive/10 text-destructive border-destructive/30",
              status === "not-started" && "bg-secondary text-muted-foreground border-border"
            )}
          >
            {STAGE_STATUS_LABELS[status]}
          </span>
        </div>
        <CardTitle className="text-xl font-bold uppercase tracking-tight">
          {stage.label}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground mt-1">
          {stage.summary}
        </CardDescription>

        {enabledPhaseIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-3">
            {enabledPhaseIds.map((phaseId) => (
              <span
                key={phaseId}
                className="inline-flex items-center px-2 py-0.5 text-xs bg-muted/60 text-muted-foreground rounded"
              >
                {PHASE_TAB_LABELS[phaseId] ?? phaseId}
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      <CardFooter className="p-6 pt-0 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 mt-4">
        <NextActionButton
          projectId={projectId}
          action={resolvedAction}
          skippedPhases={skippedPhases}
        />

        {skippedStagePhases.length > 0 && onToggleSkip && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground hover:text-foreground h-8"
                aria-label="Add a section"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add a section</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {skippedStagePhases.map((phaseId) => (
                <DropdownMenuItem
                  key={phaseId}
                  onClick={() => onToggleSkip(phaseId, false)}
                  className="cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  {PHASE_TAB_LABELS[phaseId] ?? phaseId}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardFooter>
    </Card>
  );
}
