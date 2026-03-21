'use client';

import Link from 'next/link';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface ProjectCardProps {
  project: {
    _id: string;
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
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function HealthBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary'; icon: typeof CheckCircle2; className: string } | null> = {
    passed: { label: 'Verified', variant: 'default' as const, icon: CheckCircle2, className: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' },
    failed: { label: 'Issues', variant: 'destructive' as const, icon: AlertTriangle, className: '' },
    warning: { label: 'Warning', variant: 'secondary' as const, icon: AlertTriangle, className: 'bg-amber-500/20 text-amber-500 border-amber-500/30' },
    not_checked: null,
  };

  const badge = config[status ?? 'not_checked'];
  if (!badge) return null;

  const Icon = badge.icon;

  return (
    <Badge variant={badge.variant} className={cn('gap-1', badge.className)}>
      <Icon className="w-3 h-3" />
      {badge.label}
    </Badge>
  );
}

export function ProjectCard({ project, metrics, isPinned, onPin, onUnpin }: ProjectCardProps) {
  const pinProject = useMutation(api.userPreferences.pinProject);
  const unpinProject = useMutation(api.userPreferences.unpinProject);
  const [isPinning, setIsPinning] = React.useState(false);

  const progress = metrics?.completionPercentage ?? 0;
  const completedPhases = metrics?.completedPhases ?? 0;
  const totalPhases = metrics?.totalPhases ?? 0;
  const hasStale = metrics?.stalenessFlags?.some((f) => f.isStale) ?? false;

  async function handlePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsPinning(true);
    try {
      if (isPinned) {
        await unpinProject({ projectId: project._id as any });
        onUnpin?.();
        toast.success('Project unpinned');
      } else {
        await pinProject({ projectId: project._id as any });
        onPin?.();
        toast.success('Project pinned');
      }
    } catch (err) {
      toast.error(isPinned ? 'Failed to unpin' : 'Failed to pin', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsPinning(false);
    }
  }

  return (
    <div className="relative group">
      <Link href={`/project/${project._id}`} className="block">
        <Card
          className={cn(
            'h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1',
            'border-l-4',
            project.status === 'complete' && 'border-l-emerald-500',
            project.status === 'active' && 'border-l-primary',
            project.status === 'draft' && 'border-l-muted'
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg font-bold truncate pr-4 group-hover:text-primary transition-colors">
                  {project.title}
                </CardTitle>
                <CardDescription className="line-clamp-2 mt-1 text-sm">
                  {project.description}
                </CardDescription>
              </div>

              {isPinned && (
                <div className="absolute top-4 right-12">
                  <Pin className="w-4 h-4 text-primary fill-primary" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              {hasStale && (
                <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-500 border-amber-500/30">
                  <RefreshCw className="w-3 h-3" />
                  Stale
                </Badge>
              )}
              <HealthBadge status={metrics?.verificationStatus ?? 'not_checked'} />
              {project.status === 'complete' && (
                <Badge variant="default" className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                  Complete
                </Badge>
              )}
              {project.status === 'active' && (
                <Badge variant="secondary">Active</Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Progress</span>
                <span className="font-bold tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="flex gap-0.5">
              {PHASE_ORDER.map((phaseId, idx) => {
                const isCompleted = idx < completedPhases;
                const isCurrent = phaseId === metrics?.currentPhaseId;

                return (
                  <div
                    key={phaseId}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all duration-300',
                      isCompleted && 'bg-emerald-500',
                      isCurrent && !isCompleted && 'bg-primary animate-pulse',
                      !isCompleted && !isCurrent && 'bg-muted/50'
                    )}
                    title={PHASE_LABELS[phaseId]}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span className="capitalize">{project.status}</span>
              <span>{formatRelativeTime(project.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      </Link>

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.preventDefault()}
              className="w-8 h-8 rounded-none bg-background/90 backdrop-blur border border-border hover:border-primary hover:bg-background flex items-center justify-center transition-colors"
              aria-label="Project actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handlePin} disabled={isPinning}>
              {isPinning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isPinned ? (
                <PinOff className="mr-2 h-4 w-4" />
              ) : (
                <Pin className="mr-2 h-4 w-4" />
              )}
              {isPinned ? 'Unpin Project' : 'Pin Project'}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

import React from 'react';
