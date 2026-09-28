"use client";

import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  PHASE_STATUS_WORDS,
  PROJECT_OUTLINE,
  phaseLabel,
  phaseState,
  type PhaseId,
  type PhaseRawStatus,
  type PhaseStatusMap,
} from "@/lib/workflow";

export interface ProjectNavProps {
  projectId: string;
  title: string;
  modeLabel: string;
  phases: PhaseStatusMap;
  skippedPhases?: readonly (PhaseId | string)[];
  /** The phase this page shows. Absent on a page that is not a phase, such as a change. */
  currentPhase?: PhaseId | string;
  /** What the phone button names when there is no current phase. */
  currentLabel?: string;
  className?: string;
}

const MARK: Record<PhaseRawStatus, string> = {
  ready: "rounded-[3px] border-ink bg-ink",
  generating: "rounded-full border-brand bg-brand motion-safe:animate-pulse",
  pending: "rounded-[3px] border-line-strong",
  error: "rounded-[3px] border-destructive bg-destructive",
  skipped: "rounded-[3px] border-dashed border-line-strong",
};

const CURRENT_MARK = "rounded-full border-brand bg-brand ring-3 ring-brand/20";

/** Where the reader is among the phases they can open: "3 of 7". Skipped phases do not count. */
export function outlinePosition(
  phases: PhaseStatusMap,
  skippedPhases: readonly (PhaseId | string)[],
  currentPhase: PhaseId | string
): { index: number; total: number } {
  const enabled = PROJECT_OUTLINE.flatMap((group) => group.phaseIds).filter(
    (phaseId) => phaseState(phases, skippedPhases, phaseId) !== "skipped" || phaseId === currentPhase
  );
  return { index: enabled.indexOf(currentPhase as PhaseId) + 1, total: enabled.length };
}

function PhaseList({
  projectId,
  phases,
  skippedPhases = [],
  currentPhase,
  inDialog = false,
}: Pick<ProjectNavProps, "projectId" | "phases" | "skippedPhases" | "currentPhase"> & {
  inDialog?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-4">
      {PROJECT_OUTLINE.map((group) => (
        <li key={group.label}>
          <p className="px-2.5 pb-1 text-caption text-dim">{group.label}</p>
          <ol>
            {group.phaseIds.map((phaseId) => {
              const status = phaseState(phases, skippedPhases, phaseId);
              const current = phaseId === currentPhase;
              const link = (
                <Link
                  href={`/project/${projectId}/phase/${phaseId}` as Route}
                  aria-current={current ? "page" : undefined}
                  aria-label={`${phaseLabel(phaseId)}, ${PHASE_STATUS_WORDS[status]}`}
                  className={cn(
                    "grid grid-cols-[0.625rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-ui",
                    "transition-colors duration-(--duration-quick) ease-(--ease-quiet-out) hover:bg-raised focus-ring",
                    current
                      ? "bg-raised font-semibold text-ink shadow-[inset_2px_0_0_var(--color-brand)]"
                      : status === "skipped"
                        ? "text-dim"
                        : "text-ink"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-2.5 border-[1.5px]", current ? CURRENT_MARK : MARK[status])}
                  />
                  <span className="truncate">{phaseLabel(phaseId)}</span>
                  <span className="text-caption font-normal text-dim">
                    {PHASE_STATUS_WORDS[status]}
                  </span>
                </Link>
              );

              return (
                <li key={phaseId}>
                  {inDialog ? <DialogClose asChild>{link}</DialogClose> : link}
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function ProjectHeading({
  projectId,
  title,
  modeLabel,
}: Pick<ProjectNavProps, "projectId" | "title" | "modeLabel">) {
  return (
    <div className="px-2.5 pb-5">
      <Link href="/dashboard" className="rounded-sm text-caption text-dim hover:text-ink focus-ring">
        All projects
      </Link>
      <Link
        href={`/project/${projectId}` as Route}
        className="mt-2 block rounded-sm font-display text-body font-semibold text-ink hover:underline underline-offset-4 focus-ring"
      >
        {title}
      </Link>
      <p className="text-caption text-dim">{modeLabel} mode</p>
    </div>
  );
}

/**
 * The project's phases beside the page, each with its status, so the reader always sees where they
 * are and can open any phase. Below `lg` it folds into one button that names the project and the
 * phase and opens the same list as a drawer.
 */
export function ProjectNav(props: ProjectNavProps) {
  const { projectId, title, modeLabel, phases, skippedPhases = [], currentPhase, currentLabel, className } = props;
  const place = currentPhase ? outlinePosition(phases, skippedPhases, currentPhase) : null;
  const here = currentPhase ? phaseLabel(currentPhase) : (currentLabel ?? "Phases");

  return (
    <>
      <nav
        aria-label="Project"
        className={cn(
          "hidden lg:block lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:max-h-[calc(100vh-var(--header-height)-4rem)] lg:overflow-y-auto",
          className
        )}
      >
        <ProjectHeading projectId={projectId} title={title} modeLabel={modeLabel} />
        <PhaseList {...props} />
      </nav>

      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label={`${title}, ${here}${place ? `, phase ${place.index} of ${place.total}` : ""}. Show all phases`}
            className="inline-flex max-w-full items-center gap-2.5 rounded-sm border border-line-strong bg-surface py-1.5 pr-3 pl-2 text-ui transition-transform active:scale-[0.97] motion-reduce:active:scale-100 focus-ring lg:hidden"
          >
            {place ? <span aria-hidden className={cn("size-2.5 shrink-0 border-[1.5px]", CURRENT_MARK)} /> : null}
            <span className="min-w-0 truncate">
              {title}
              <span className="text-dim"> / </span>
              <span className="font-semibold">{here}</span>
            </span>
            {place ? (
              <span className="shrink-0 font-mono text-caption text-dim">
                {place.index} of {place.total}
              </span>
            ) : null}
          </button>
        </DialogTrigger>
        <DialogContent className="fixed top-0 bottom-0 left-0 h-full content-start w-[min(88vw,20rem)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none rounded-r-lg border-y-0 border-l-0 border-r border-line bg-surface px-3 py-5">
          <DialogTitle className="sr-only">Project phases</DialogTitle>
          <DialogDescription className="sr-only">Open any phase of {title}.</DialogDescription>
          <ProjectHeading projectId={projectId} title={title} modeLabel={modeLabel} />
          <PhaseList {...props} inDialog />
        </DialogContent>
      </Dialog>
    </>
  );
}
