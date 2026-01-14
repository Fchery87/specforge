"use client";

import Link from "next/link";
import { cn } from "@/lib/markdown";
import { Badge } from "@/components/ui/badge";

const PHASES = [
  { id: "brief", label: "Brief" },
  { id: "prd", label: "PRD" },
  { id: "specs", label: "Spec & Architecture" },
  { id: "stories", label: "Tasks/Stories" },
  { id: "artifacts", label: "Artifacts" },
  { id: "handoff", label: "Handoff + ZIP" },
];

export function PhaseStepper({ projectId, currentPhase }: { projectId: string; currentPhase: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PHASES.map((p, idx) => {
        const active = p.id === currentPhase;
        return (
          <Link
            key={p.id}
            href={`/project/${projectId}/phase/${p.id}`}
            className={cn(
              "px-3 py-2 rounded-xl border border-border bg-background hover:bg-card transition",
              active && "shadow-brutal"
            )}
          >
            <div className="flex items-center gap-2">
              <Badge variant={active ? "default" : "outline"}>{idx + 1}</Badge>
              <span className="text-sm">{p.label}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
