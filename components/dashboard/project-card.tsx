'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { StageBand } from '@/components/stage-band';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Pin,
  PinOff,
  Copy,
  Trash2,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

import type { Route } from 'next';
import {
  nextAction,
  WORKFLOW_STAGES,
  type NextAction,
  type PhaseId,
  type PhaseStatusMap,
  type ProjectMode,
  PHASE_ORDER,
  MODE_POLICIES,
} from '@/lib/workflow';

export function getDashboardCardAction(
  action: NextAction,
  projectId: string,
  skippedPhases: readonly (PhaseId | string)[] = [],
): { label: string; href: string } {
  if (action.kind === 'export') {
    return {
      label: 'Export',
      href: `/project/${projectId}/phase/handoff`,
    };
  }

  let stageLabel = 'Requirements';
  let targetPhase: PhaseId = 'brief';

  if (action.kind === 'continue' || action.kind === 'review') {
    const stage = WORKFLOW_STAGES.find((s) => s.id === action.stageId) ?? WORKFLOW_STAGES[0];
    stageLabel = stage.label;
    const enabledPhases = stage.phaseIds.filter((p) => !skippedPhases.includes(p));
    targetPhase = enabledPhases[0] ?? stage.phaseIds[0];
  } else {
    const stage = WORKFLOW_STAGES.find((s) => s.phaseIds.includes(action.phaseId)) ?? WORKFLOW_STAGES[0];
    stageLabel = stage.label;
    targetPhase = action.phaseId;
  }

  return {
    label: `Resume at ${stageLabel}`,
    href: `/project/${projectId}/phase/${targetPhase}`,
  };
}

export interface ProjectCardProps {
  project: {
    _id: Id<'projects'>;
    title: string;
    description: string;
    status: 'draft' | 'active' | 'complete';
    mode?: 'full' | 'quick' | 'backend';
    skippedPhases?: string[];
    createdAt: number;
    updatedAt: number;
  };
  metrics?: {
    completionPercentage: number;
    completedPhases: number;
    totalPhases: number;
    healthScore: number;
    stalenessFlags: { isStale: boolean }[];
    verificationStatus: 'passed' | 'failed' | 'warning' | 'not_checked';
    currentPhaseId?: string;
  };
  phases?: PhaseStatusMap;
  isPinned?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  onDelete?: () => void;
}

const VERIFICATION_WORD: Record<string, { label: string; tone: string } | undefined> = {
  passed: { label: 'Verified', tone: 'text-success' },
  failed: { label: 'Verification failed', tone: 'text-destructive' },
  warning: { label: 'Verification warning', tone: 'text-warning' },
};

const STATUS_WORD: Record<ProjectCardProps['project']['status'], string> = {
  draft: 'Draft',
  active: 'Active',
  complete: 'Complete',
};

export function ProjectCard({
  project,
  metrics,
  phases,
  isPinned,
  onPin,
  onUnpin,
  onDelete,
}: ProjectCardProps) {
  const pinProject = useMutation(api.userPreferences.pinProject);
  const unpinProject = useMutation(api.userPreferences.unpinProject);
  const [isPinning, setIsPinning] = React.useState(false);

  // Fallback to reactive metrics if not provided by parent query
  const liveMetrics = useQuery(
    api.projectMetrics.getProjectMetrics,
    !metrics ? { projectId: project._id } : 'skip'
  );

  const effectiveMetrics = metrics ?? (liveMetrics ? {
    completionPercentage: liveMetrics.completionPercentage,
    completedPhases: liveMetrics.completedPhases,
    totalPhases: liveMetrics.totalPhases,
    healthScore: liveMetrics.healthScore,
    stalenessFlags: liveMetrics.stalenessFlags,
    verificationStatus: liveMetrics.verificationStatus,
    currentPhaseId: liveMetrics.currentPhaseId,
  } : undefined);

  // Fallback to reactive phases if not provided by parent query
  const queriedPhases = useQuery(
    api.projects.getProjectPhases,
    !phases ? { projectId: project._id } : 'skip'
  );

  const effectivePhases = phases ?? queriedPhases ?? [];
  const skipped = (project.skippedPhases ?? []) as readonly PhaseId[];
  const mode = (project.mode ?? 'full') as ProjectMode;

  const currentNextAction = React.useMemo(() => {
    return nextAction(effectivePhases, skipped, mode);
  }, [effectivePhases, skipped, mode]);

  const { label: ctaLabel, href: ctaHref } = React.useMemo(() => {
    return getDashboardCardAction(currentNextAction, project._id, skipped);
  }, [currentNextAction, project._id, skipped]);

  const completedPhases = effectiveMetrics?.completedPhases ?? 0;
  const totalPhases = effectiveMetrics?.totalPhases ?? PHASE_ORDER.length;
  const hasStale = effectiveMetrics?.stalenessFlags?.some((f) => f.isStale) ?? false;

  async function handlePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsPinning(true);
    try {
      if (isPinned) {
        await unpinProject({ projectId: project._id });
        onUnpin?.();
        toast.success('Project unpinned');
      } else {
        await pinProject({ projectId: project._id });
        onPin?.();
        toast.success('Project pinned');
      }
    } catch (err) {
      toast.error(isPinned ? 'Failed to unpin project' : 'Failed to pin project', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsPinning(false);
    }
  }

  function handleCopyId(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(project._id);
    toast.success('Project ID copied to clipboard');
  }

  const verification = VERIFICATION_WORD[effectiveMetrics?.verificationStatus ?? 'not_checked'];

  return (
    <div
      className={cn(
        'group relative grid items-center gap-x-8 gap-y-3 px-5 py-4 transition-colors duration-(--duration-quick)',
        'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_10rem_13rem] hover:bg-void'
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span className="truncate text-body font-semibold text-ink">{project.title}</span>
          {isPinned ? (
            <Pin aria-label="Pinned" className="size-3.5 shrink-0 fill-brand text-brand" />
          ) : null}
        </p>
        <p className="truncate text-ui text-muted-foreground">
          {project.description || 'No description provided.'}
        </p>
        <p className="mt-0.5 text-caption text-dim">
          <span>{STATUS_WORD[project.status]}</span>
          {project.mode ? (
            <>
              <span aria-hidden>, </span>
              <span>{MODE_POLICIES[project.mode].label} mode</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="min-w-0">
        <StageBand phases={effectivePhases} skippedPhases={skipped} />
      </div>

      <div className="text-label">
        <p className="text-muted-foreground">
          {completedPhases} of {totalPhases} phases ready
        </p>
        {verification || hasStale ? (
          <p className="flex items-center gap-2">
            {verification ? <span className={verification.tone}>{verification.label}</span> : null}
            {hasStale ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <RefreshCw aria-hidden className="size-3" />
                Stale
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4 md:justify-end">
        <div className="md:text-right">
          {/* The row is one target: this link stretches over it. The options menu sits above it. */}
          <Link
            href={ctaHref as Route}
            className="rounded-sm text-label font-semibold text-brand focus-ring after:absolute after:inset-0 after:content-['']"
          >
            {ctaLabel}
          </Link>
          <p className="text-caption text-dim">Updated {formatRelativeTime(project.updatedAt)}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative z-10 flex size-8 items-center justify-center rounded-sm text-dim transition-colors hover:bg-raised hover:text-ink focus-ring"
              aria-label="Project options"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handlePin} disabled={isPinning}>
              {isPinning ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : isPinned ? (
                <PinOff className="mr-2 size-4" />
              ) : (
                <Pin className="mr-2 size-4" />
              )}
              <span>{isPinned ? 'Unpin project' : 'Pin project'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyId}>
              <Copy className="mr-2 size-4" />
              <span>Copy ID</span>
            </DropdownMenuItem>
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
