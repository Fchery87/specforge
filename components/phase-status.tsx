"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface PhaseStatusIndicatorProps {
  phases: Array<{
    phaseId: string;
    status: string;
  }>;
  currentPhase: string;
  projectId: string;
}

const PHASE_CONFIG = [
  { id: "brief", label: "Brief", color: "bg-blue-500" },
  { id: "prd", label: "PRD", color: "bg-indigo-500" },
  { id: "specs", label: "Specs & Architecture", color: "bg-purple-500" },
  { id: "stories", label: "Tasks/Stories", color: "bg-amber-500" },
  { id: "artifacts", label: "Artifacts", color: "bg-green-500" },
  { id: "handoff", label: "Handoff + ZIP", color: "bg-pink-500" },
];

export function PhaseStatusIndicator({ phases, currentPhase, projectId }: PhaseStatusIndicatorProps) {
  const getPhaseStatus = (phaseId: string): string => {
    const phase = phases.find(p => p.phaseId === phaseId);
    return phase?.status || "pending";
  };

  const isCompleted = (phaseId: string): boolean => {
    const phaseIndex = PHASE_CONFIG.findIndex(p => p.id === phaseId);
    const currentIndex = PHASE_CONFIG.findIndex(p => p.id === currentPhase);
    const status = getPhaseStatus(phaseId);
    return phaseIndex < currentIndex || status === "ready";
  };

  const isCurrent = (phaseId: string): boolean => phaseId === currentPhase;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PHASE_CONFIG.map((phase, idx) => {
        const status = getPhaseStatus(phase.id);
        const completed = isCompleted(phase.id);
        const current = isCurrent(phase.id);
        const isGenerating = status === "generating";
        const isError = status === "error";

        return (
          <div key={phase.id} className="flex items-center">
            <Link
              href={`/project/${projectId}/phase/${phase.id}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-2 transition-all duration-200",
                "hover:border-primary focus-ring",
                current && "border-primary bg-primary/5",
                !current && "border-border bg-card hover:bg-secondary/30",
                completed && !current && "border-success/50",
                isError && "border-destructive/50"
              )}
            >
              {/* Status Icon */}
              <div className={cn(
                "flex-shrink-0 w-6 h-6 flex items-center justify-center border-2 transition-colors",
                completed && "bg-success border-success text-success-foreground",
                current && !completed && "border-primary bg-primary/20",
                isGenerating && "border-warning bg-warning/20",
                isError && "border-destructive bg-destructive/20",
                !completed && !current && !isGenerating && !isError && "border-border bg-secondary/30"
              )}>
                {completed ? (
                  <Check className="w-4 h-4" />
                ) : isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-warning" />
                ) : isError ? (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={cn(
                "text-sm font-medium uppercase tracking-tight",
                current && "text-foreground font-bold",
                !current && "text-muted-foreground"
              )}>
                {phase.label}
              </span>

              {/* Status Badge */}
              {isGenerating && (
                <Badge variant="secondary" className="text-xs ml-1">
                  Generating
                </Badge>
              )}
              {isError && (
                <Badge variant="destructive" className="text-xs ml-1">
                  Error
                </Badge>
              )}
            </Link>

            {/* Connecting Line */}
            {idx < PHASE_CONFIG.length - 1 && (
              <div className={cn(
                "w-4 md:w-8 h-0.5 mx-1",
                completed ? "bg-success/50" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pending", variant: "outline" },
    generating: { label: "Generating", variant: "secondary" },
    ready: { label: "Ready", variant: "default" },
    error: { label: "Error", variant: "destructive" },
    draft: { label: "Draft", variant: "outline" },
    active: { label: "Active", variant: "default" },
    complete: { label: "Complete", variant: "default" },
  };

  const { label, variant } = config[status] || { label: status, variant: "outline" };

  return <Badge variant={variant}>{label}</Badge>;
}

export function ProgressIndicator({ 
  current, 
  total, 
  label 
}: { 
  current: number; 
  total: number; 
  label?: string;
}) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground font-medium">{current}/{total}</span>
        </div>
      )}
      <div className="h-2 bg-secondary overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">{percentage}%</p>
    </div>
  );
}
