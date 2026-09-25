"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  WORKFLOW_STAGES,
  type NextAction,
  type PhaseId,
} from "@/lib/workflow";

export interface NextActionButtonProps {
  projectId: string;
  action: NextAction;
  skippedPhases?: readonly (PhaseId | string)[];
  firstEnabledPhaseInDesign?: PhaseId | string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

function resolveFirstEnabledPhaseInDesign(
  skippedPhases: readonly (PhaseId | string)[] = [],
  override?: PhaseId | string,
): PhaseId {
  if (override) return override as PhaseId;
  const designStage = WORKFLOW_STAGES.find((s) => s.id === "design");
  const enabledPhase = designStage?.phaseIds.find(
    (id) => !skippedPhases.includes(id),
  );
  return (enabledPhase ?? "domainModel") as PhaseId;
}

export function getNextActionLink(
  action: NextAction,
  projectId: string,
  skippedPhases: readonly (PhaseId | string)[] = [],
  firstEnabledPhaseInDesign?: PhaseId | string,
): { label: string; href: string } {
  switch (action.kind) {
    case "answer":
      return {
        label: "Answer questions",
        href: `/project/${projectId}/phase/${action.phaseId}`,
      };
    case "generate":
      return {
        label: "Generate",
        href: `/project/${projectId}/phase/${action.phaseId}`,
      };
    case "continue": {
      if (action.stageId === "design") {
        const targetPhase = resolveFirstEnabledPhaseInDesign(
          skippedPhases,
          firstEnabledPhaseInDesign,
        );
        return {
          label: "Continue to Design",
          href: `/project/${projectId}/phase/${targetPhase}`,
        };
      }
      if (action.stageId === "tasks") {
        return {
          label: "Continue to Tasks",
          href: `/project/${projectId}/phase/stories`,
        };
      }
      return {
        label: "Continue",
        href: `/project/${projectId}/phase/brief`,
      };
    }
    case "export":
      return {
        label: "Export",
        href: `/project/${projectId}/phase/handoff`,
      };
    case "review": {
      const stage = WORKFLOW_STAGES.find((s) => s.id === action.stageId);
      const targetPhase =
        stage?.phaseIds.find((id) => !skippedPhases.includes(id)) ??
        stage?.phaseIds[0] ??
        "brief";
      return {
        label: `Review ${stage?.label ?? "Stage"}`,
        href: `/project/${projectId}/phase/${targetPhase}`,
      };
    }
  }
}

export function NextActionButton({
  projectId,
  action,
  skippedPhases = [],
  firstEnabledPhaseInDesign,
  className,
  variant = "default",
  size = "default",
}: NextActionButtonProps) {
  const { label, href } = getNextActionLink(
    action,
    projectId,
    skippedPhases,
    firstEnabledPhaseInDesign,
  );

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={href as Route}>
        {label}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Link>
    </Button>
  );
}
