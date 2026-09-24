'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

const PHASE_ORDER = ['brief', 'constitution', 'prd', 'domainModel', 'spec', 'userStories', 'handoff'];
const PHASE_LABELS: Record<string, string> = {
  brief: 'Brief',
  constitution: 'Constitution',
  prd: 'PRD',
  domainModel: 'Domain',
  spec: 'Spec',
  userStories: 'Stories',
  handoff: 'Handoff',
};

export interface ProjectCardProps {
  project: {
    _id: Id<'projects'>;
    title: string;
    description: string;
    status: 'draft' | 'active' | 'complete';
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
  isPinned?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  onDelete?: () => void;
}

function HealthBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; icon: typeof CheckCircle2; className: string } | null
  > = {
    passed: {
      label: 'Verified',
      icon: CheckCircle2,
      className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    },
    failed: {
      label: 'Issues',
      icon: AlertTriangle,
      className: 'bg-destructive/10 text-destructive border-destructive/30',
    },
    warning: {
      label: 'Warning',
      icon: AlertTriangle,
      className: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    },
    not_checked: null,
  };

  const badge = config[status ?? 'not_checked'];
  if (!badge) return null;

  const Icon = badge.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border',
        badge.className
      )}
    >
      <Icon className="w-3 h-3" />
      {badge.label}
    </span>
  );
}

export function ProjectCard({
  project,
  metrics,
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

  const progress = effectiveMetrics?.completionPercentage ?? 0;
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

  return (
    <div className="relative group h-full">
      <Link href={`/project/${project._id}`} className="block h-full">
        <Card
          variant="interactive"
          className={cn(
            'h-full relative overflow-hidden flex flex-col justify-between',
            'transition-all duration-200 border-2',
            project.status === 'complete' && 'border-t-emerald-500/80',
            project.status === 'active' && 'border-t-primary/80',
            project.status === 'draft' && 'border-t-muted'
          )}
        >
          {/* Top Status Accent Bar */}
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-1',
              project.status === 'complete' && 'bg-emerald-500',
              project.status === 'active' && 'bg-primary',
              project.status === 'draft' && 'bg-muted-foreground/30'
            )}
          />

          <CardHeader className="p-5 sm:p-6 pb-4 space-y-3">
            {/* Header Status & Action Controls */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {/* Status Badge */}
                {project.status === 'complete' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Complete
                  </span>
                )}
                {project.status === 'active' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Active
                  </span>
                )}
                {project.status === 'draft' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-secondary/60 text-muted-foreground border border-border/60 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                    Draft
                  </span>
                )}

                {/* Health & Staleness Badges */}
                <HealthBadge status={effectiveMetrics?.verificationStatus ?? 'not_checked'} />
                {hasStale && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded">
                    <RefreshCw className="w-2.5 h-2.5" />
                    Stale
                  </span>
                )}
              </div>

              {/* Pin & Dropdown Actions */}
              <div
                className="flex items-center gap-1 z-10 shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {isPinned && (
                  <div
                    className="w-7 h-7 flex items-center justify-center bg-primary/10 border border-primary/30 text-primary"
                    title="Pinned project"
                  >
                    <Pin className="w-3.5 h-3.5 fill-primary" />
                  </div>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-7 h-7 rounded border border-border/60 bg-secondary/40 hover:bg-secondary hover:border-primary/50 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                      aria-label="Project options"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={handlePin} disabled={isPinning}>
                      {isPinning ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isPinned ? (
                        <PinOff className="mr-2 h-4 w-4" />
                      ) : (
                        <Pin className="mr-2 h-4 w-4" />
                      )}
                      <span>{isPinned ? 'Unpin Project' : 'Pin Project'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyId}>
                      <Copy className="mr-2 h-4 w-4" />
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
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <CardTitle className="text-base sm:text-lg font-bold tracking-tight truncate group-hover:text-primary transition-colors">
                {project.title}
              </CardTitle>
              <CardDescription className="line-clamp-2 text-xs sm:text-sm text-muted-foreground leading-relaxed min-h-[2.5rem]">
                {project.description || 'No description provided.'}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
            {/* Segmented Phase Pipeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pipeline Progress
                </span>
                <span className="font-mono font-bold text-foreground tabular-nums text-xs">
                  {completedPhases}/{totalPhases} ({progress}%)
                </span>
              </div>

              {/* Segmented Phase Track */}
              <div className="flex gap-1 h-1.5 w-full">
                {PHASE_ORDER.map((phaseId, idx) => {
                  const isCompleted = idx < completedPhases;
                  const isCurrent = phaseId === effectiveMetrics?.currentPhaseId;

                  return (
                    <div
                      key={phaseId}
                      className={cn(
                        'h-full flex-1 rounded-sm transition-all duration-300',
                        isCompleted && 'bg-emerald-500',
                        isCurrent && !isCompleted && 'bg-primary animate-pulse',
                        !isCompleted && !isCurrent && 'bg-muted/40 hover:bg-muted/70'
                      )}
                      title={`Phase ${idx + 1}: ${PHASE_LABELS[phaseId]} ${
                        isCompleted
                          ? '(Completed)'
                          : isCurrent
                            ? '(In Progress)'
                            : '(Pending)'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Footer Metadata & CTA */}
            <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
              <span className="flex items-center text-muted-foreground text-[11px] sm:text-xs">
                <Clock className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/70" />
                Updated {formatRelativeTime(project.updatedAt)}
              </span>
              <span className="flex items-center font-bold uppercase tracking-wider text-[11px] sm:text-xs text-primary group-hover:text-primary transition-colors">
                Open <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
