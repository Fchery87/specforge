"use client";

import Link from "next/link";
import { cn } from "@/lib/markdown";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, AlertCircle } from "lucide-react";

const PHASES = [
  { id: "brief", label: "Brief" },
  { id: "prd", label: "PRD" },
  { id: "specs", label: "Spec & Architecture" },
  { id: "stories", label: "Tasks/Stories" },
  { id: "artifacts", label: "Artifacts" },
  { id: "handoff", label: "Handoff + ZIP" },
];

type PhaseStatus = "pending" | "generating" | "ready" | "error";

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
    <div className="flex flex-wrap items-center gap-2">
      {PHASES.map((p, idx) => {
        const active = p.id === currentPhase;
        const status = phaseStatuses?.[p.id] ?? "pending";
        const showIcon = status !== "pending";
        const statusAccent =
          !active && status === "ready"
            ? "border-success/50"
            : !active && status === "error"
              ? "border-destructive/50"
              : !active && status === "generating"
                ? "border-warning/50"
                : "";
        return (
          <Link
            key={p.id}
            href={`/project/${projectId}/phase/${p.id}`}
            className={cn(
              "px-3 py-2 rounded-xl border border-border bg-background hover:bg-card transition",
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
                    status === "error" && "border-destructive bg-destructive/20 text-destructive"
                  )}
                  aria-hidden
                >
                  {status === "ready" ? (
                    <Check className="w-4 h-4" />
                  ) : status === "generating" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                </div>
              ) : (
                <Badge variant={active ? "default" : "outline"}>{idx + 1}</Badge>
              )}
              <span className="text-sm">{p.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
