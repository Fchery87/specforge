"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/phase-status";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PhaseStatus = "pending" | "generating" | "ready" | "error" | "skipped";

interface ProjectPhaseCardProps {
  projectId: string;
  phaseId: string;
  label: string;
  description: string;
  icon: LucideIcon;
  index: number;
  status?: PhaseStatus;
  isSkipped?: boolean;
  onToggleSkip?: (skip: boolean) => void;
}

export function ProjectPhaseCard({
  projectId,
  phaseId,
  label,
  description,
  icon: Icon,
  index,
  status = "pending",
  isSkipped = false,
  onToggleSkip,
}: ProjectPhaseCardProps) {
  const showBadge = status !== "pending";
  const statusAccent = isSkipped
    ? "border-muted/50"
    : status === "ready"
      ? "border-success/50"
      : status === "error"
        ? "border-destructive/50"
        : status === "generating"
          ? "border-warning/50"
          : "";

  return (
    <Link href={`/project/${projectId}/phase/${phaseId}`} className="block">
      <Card
        variant="interactive"
        className={cn("relative h-full group border-2", statusAccent, isSkipped && "opacity-60")}
      >
        <CardHeader>
          <div className="text-6xl font-bold text-muted/20 absolute top-4 right-4 group-hover:text-black/10 transition-colors">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="w-12 h-12 border-2 border-border bg-secondary/30 flex items-center justify-center mb-4 group-hover:border-black group-hover:bg-black/10 transition-colors">
            <Icon className="w-6 h-6 text-muted-foreground group-hover:text-black transition-colors" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{label}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {isSkipped && (
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground border border-muted px-2 py-0.5">
                  Skipped
                </span>
              )}
              {showBadge && !isSkipped && <StatusBadge status={status} />}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center text-primary group-hover:text-black font-bold uppercase tracking-tight text-sm transition-colors">
              Enter Phase <ArrowRight className="w-4 h-4 ml-2" />
            </div>
            {onToggleSkip && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSkip(!isSkipped);
                }}
              >
                {isSkipped ? "Unskip" : "Skip"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
