"use client";

import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { WORKFLOW_STAGES, phaseLabel, type PhaseId } from "@/lib/workflow";

export interface StagePhaseLinksProps {
  projectId: string;
  currentPhase: string;
  skippedPhases?: readonly string[];
  className?: string;
}

/**
 * The phases inside the current stage, as links.
 *
 * The stepper links once per stage, to a single target phase, so a stage that has finished generating
 * left its other phases with no way in: after a Full project generated the Brief and the PRD, nothing
 * linked to `/phase/prd`, and once the Design phases were all ready nothing linked to `/phase/specs`
 * or `/phase/artifacts`. A generated document nobody can open is the one thing a specification reader
 * must not do.
 *
 * This is deliberately not another description of the workflow. It lists only the phases of the stage
 * the reader is already in, which is at most three links, and it carries no status: the stepper shows
 * the stage's state and each phase page shows its own. Skipped phases are absent here and are
 * re-enabled from `AddSectionMenu`, so there is still one control for that.
 */
export function StagePhaseLinks({
  projectId,
  currentPhase,
  skippedPhases = [],
  className,
}: StagePhaseLinksProps) {
  const stage = WORKFLOW_STAGES.find((candidate) =>
    (candidate.phaseIds as readonly string[]).includes(currentPhase)
  );

  // A phase outside every stage (the rules phase, the export) has no siblings to list.
  if (!stage) return null;

  const visible = stage.phaseIds.filter(
    (id) => !skippedPhases.includes(id)
  ) as readonly PhaseId[];

  if (visible.length < 2) return null;

  return (
    <nav aria-label={`${stage.label} sections`} className={cn("min-w-0", className)}>
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {visible.map((phaseId) => {
          const current = phaseId === currentPhase;

          return (
            <li key={phaseId}>
              <Link
                href={`/project/${projectId}/phase/${phaseId}` as Route}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex rounded-sm px-2.5 py-1 text-label transition-colors",
                  "duration-(--duration-quick) ease-(--ease-quiet-out)",
                  current
                    ? "bg-raised text-ink"
                    : "text-dim hover:bg-raised/60 hover:text-ink"
                )}
              >
                {phaseLabel(phaseId)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
