"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, AlertCircle, Minus } from "lucide-react";
import { PROJECT_PHASES } from "@/lib/phase-config";

type PhaseStatus = "pending" | "generating" | "ready" | "error" | "skipped";

export function PhaseStepper({
  projectId,
  currentPhase,
  phaseStatuses,
}: {
  projectId: string;
  currentPhase: string;
  phaseStatuses?: Record<string, PhaseStatus>;
}) {
  return (
    <nav aria-label="Project phases" className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin md:flex-wrap md:pb-0">
      {PROJECT_PHASES.map((p, idx) => {
        const active = p.id === currentPhase;
        const status = phaseStatuses?.[p.id] ?? "pending";
        const isSkipped = status === "skipped";
        const showIcon = status !== "pending";
        const statusAccent =
          !active && status === "ready"
            ? "border-success/50"
            : !active && status === "error"
              ? "border-destructive/50"
              : !active && status === "generating"
                ? "border-warning/50"
                : !active && isSkipped
                  ? "border-dashed border-border/80 opacity-70"
                  : "";
        return (
          <Link
            key={p.id}
            href={`/project/${projectId}/phase/${p.id}`}
            className={cn(
              "shrink-0 px-3 py-2 rounded-xl border border-border bg-background hover:bg-card transition",
              active && "shadow-brutal",
              statusAccent
            )}
          >
            <div className="flex items-center gap-2">
              {showIcon ? (
                <div
                  className={cn(
                    "w-6 h-6 flex items-center justify-center border rounded-xl",
                    status === "ready" && "bg-success border-success text-success-foreground",
                    status === "generating" && "border-warning bg-warning/20 text-warning",
                    status === "error" && "border-destructive bg-destructive/20 text-destructive",
                    isSkipped && "border-dashed border-muted-foreground/40 bg-muted/40 text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {status === "ready" ? (
                    <Check className="w-4 h-4" />
                  ) : status === "generating" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isSkipped ? (
                    <Minus className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>
              ) : (
                <Badge variant={active ? "default" : "outline"}>{idx + 1}</Badge>
              )}
              <span className={cn("text-sm", isSkipped && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                {p.label}
              </span>
              {isSkipped && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Skipped
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
