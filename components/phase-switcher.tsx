"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Loader2, Circle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<string, string> = {
  constitution: "Constitution",
  brief: "Brief",
  prd: "PRD",
  domainModel: "Domain Model",
  specs: "Specifications",
  stories: "User Stories",
  artifacts: "Artifacts",
  handoff: "Handoff",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return <Check className="w-3 h-3 text-success" />;
    case "generating":
      return <Loader2 className="w-3 h-3 text-primary animate-spin" />;
    case "error":
      return <AlertTriangle className="w-3 h-3 text-destructive" />;
    default:
      return <Circle className="w-3 h-3 text-muted-foreground" />;
  }
}

interface PhaseSwitcherProps {
  currentPhaseId: string;
  phases: Array<{ phaseId: string; status: string }>;
  projectId: string;
}

export function PhaseSwitcher({ currentPhaseId, phases, projectId }: PhaseSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const currentLabel = PHASE_LABELS[currentPhaseId] ?? currentPhaseId;

  function handleSelect(phaseId: string) {
    setOpen(false);
    if (phaseId !== currentPhaseId) {
      router.push(`/project/${projectId}/phase/${phaseId}`);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentLabel}
          <ChevronDown className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {phases.map((phase) => {
          const label = PHASE_LABELS[phase.phaseId] ?? phase.phaseId;
          const isCurrent = phase.phaseId === currentPhaseId;
          return (
            <button
              key={phase.phaseId}
              type="button"
              onClick={() => handleSelect(phase.phaseId)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                "hover:bg-secondary/50",
                isCurrent && "bg-secondary/30 font-medium"
              )}
            >
              <StatusIcon status={phase.status} />
              <span className="flex-1">{label}</span>
              {isCurrent && <Check className="w-4 h-4 text-primary" aria-hidden />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
