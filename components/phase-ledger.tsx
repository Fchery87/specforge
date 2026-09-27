import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import {
  EXPORT_PHASE,
  RULES_PHASE,
  WORKFLOW_STAGES,
  phaseLabel,
  phaseState,
  stageIdForPhase,
  type PhaseId,
  type PhaseRawStatus,
  type PhaseStatusMap,
} from "@/lib/workflow";

const STATUS_WORD: Record<PhaseRawStatus, string> = {
  pending: "Not started",
  generating: "Generating",
  ready: "Ready",
  error: "Error",
  skipped: "Skipped",
};

const STATUS_TONE: Record<PhaseRawStatus, string> = {
  pending: "text-dim",
  generating: "text-brand font-medium",
  ready: "text-muted-foreground",
  error: "text-destructive font-medium",
  skipped: "text-dim",
};

/**
 * Display order: the rules, each stage's phases in stage order, then export. Not `PHASE_ORDER`, which
 * is storage order and puts Tasks between two Design phases.
 */
const LEDGER_ORDER: readonly PhaseId[] = [
  RULES_PHASE,
  ...WORKFLOW_STAGES.flatMap((stage) => stage.phaseIds),
  EXPORT_PHASE,
];

function groupLabel(phaseId: PhaseId): string {
  if (phaseId === RULES_PHASE) return "Rules";
  if (phaseId === EXPORT_PHASE) return "Export";
  const stageId = stageIdForPhase(phaseId);
  return WORKFLOW_STAGES.find((stage) => stage.id === stageId)?.label ?? "";
}

/**
 * The ledger under the stage band: every phase, its stage and its status, one row each. The band
 * says where the project is; the ledger says what each phase holds.
 */
export function PhaseLedger({
  projectId,
  phases,
  skippedPhases = [],
  currentPhase,
  className,
}: {
  projectId: string;
  phases: PhaseStatusMap;
  skippedPhases?: readonly (PhaseId | string)[];
  currentPhase?: PhaseId | string;
  className?: string;
}) {
  return (
    <table className={cn("w-full border-collapse text-ui", className)}>
      <thead>
        <tr className="text-left text-label text-dim">
          <th scope="col" className="w-10 pb-2 pl-3 font-normal">
            <span className="sr-only">Step</span>
          </th>
          <th scope="col" className="pb-2 pr-3 font-normal">Phase</th>
          <th scope="col" className="hidden w-48 pb-2 pr-3 font-normal sm:table-cell">Stage</th>
          <th scope="col" className="w-36 pb-2 pr-3 font-normal">Status</th>
        </tr>
      </thead>
      <tbody>
        {LEDGER_ORDER.map((phaseId, index) => {
          const status = phaseState(phases, skippedPhases, phaseId);
          const current = currentPhase === phaseId;

          return (
            <tr
              key={phaseId}
              aria-current={current ? "step" : undefined}
              className={cn(
                "border-t border-line",
                current && "bg-brand/5 shadow-[inset_2px_0_0_var(--color-brand)]"
              )}
            >
              <td className="py-3 pl-3 font-mono text-caption tabular-nums text-dim">{index + 1}</td>
              <td className="py-3 pr-3">
                <Link
                  href={`/project/${projectId}/phase/${phaseId}` as Route}
                  className={cn(
                    "rounded-sm text-ink underline-offset-4 hover:underline focus-ring",
                    current && "font-semibold"
                  )}
                >
                  {phaseLabel(phaseId)}
                </Link>
              </td>
              <td className="hidden py-3 pr-3 text-dim sm:table-cell">{groupLabel(phaseId)}</td>
              <td className={cn("py-3 pr-3", STATUS_TONE[status])}>{STATUS_WORD[status]}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
