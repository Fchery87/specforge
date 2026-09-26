"use client";

import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WORKFLOW_STAGES,
  type PhaseId,
  type PhaseStatusMap,
  type WorkflowStage,
} from "@/lib/workflow";

export interface StageTabsProps {
  projectId: string;
  currentPhase: PhaseId | string;
  stage?: WorkflowStage;
  phases: PhaseStatusMap;
  skippedPhases?: readonly (PhaseId | string)[];
  onToggleSkip?: (phaseId: PhaseId | string) => void;
  className?: string;
}

export const PHASE_TAB_LABELS: Record<string, string> = {
  brief: "Brief",
  prd: "PRD",
  domainModel: "Domain Model",
  specs: "Architecture",
  artifacts: "Schemas",
  stories: "Tasks",
};

export function StageTabs({
  projectId,
  currentPhase,
  stage,
  phases,
  skippedPhases = [],
  onToggleSkip,
  className,
}: StageTabsProps) {
  const currentStage =
    stage ??
    WORKFLOW_STAGES.find((s) => s.phaseIds.includes(currentPhase as PhaseId));

  if (!currentStage) {
    return null;
  }

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

  const enabledPhases = currentStage.phaseIds.filter((id) => !isPhaseSkipped(id));
  const skippedStagePhases = currentStage.phaseIds.filter((id) => isPhaseSkipped(id));

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      <nav aria-label="Stage sections" className="flex items-center gap-1 overflow-x-auto">
        {enabledPhases.map((phaseId) => {
          const isCurrent = phaseId === currentPhase;
          const label = PHASE_TAB_LABELS[phaseId] ?? phaseId;

          return (
            <Link
              key={phaseId}
              href={`/project/${projectId}/phase/${phaseId}`}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "px-3.5 py-1.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                isCurrent
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {skippedStagePhases.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs font-medium shrink-0"
              aria-label="Add a section"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add a section</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {skippedStagePhases.map((phaseId) => (
              <DropdownMenuItem
                key={phaseId}
                onClick={() => onToggleSkip?.(phaseId)}
                className="cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                {PHASE_TAB_LABELS[phaseId] ?? phaseId}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
