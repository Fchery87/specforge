"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TicketStatus = "todo" | "in_progress" | "done";
type TicketPriority = "critical" | "high" | "medium" | "low";

interface TicketCardProps {
  ticket: {
    _id: Id<"tickets">;
    title: string;
    description?: string;
    acceptanceCriteria: string[];
    status: TicketStatus;
    priority: TicketPriority;
    estimatedEffort?: string;
    order: number;
    sliceType?: "tracer_bullet" | "wide_refactor";
    dependencies?: Id<"tickets">[];
    blockedByTitles?: string[];
    filesToTouch?: string[];
    claimIds?: string[];
    evidenceReviewStatus?: "current" | "needs_review";
  };
  isBlocked?: boolean;
  onStatusChange: (id: Id<"tickets">, newStatus: TicketStatus) => void;
}

const PRIORITY_CLASS: Record<TicketPriority, string> = {
  critical: "text-destructive border-destructive/40",
  high: "text-orange-400 border-orange-400/40",
  medium: "text-yellow-400 border-yellow-400/40",
  low: "text-muted-foreground border-border",
};

const STATUS_CYCLE: Record<TicketStatus, TicketStatus> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  todo: "→ In Progress",
  in_progress: "→ Done",
  done: "→ To Do",
};

export function TicketCard({ ticket, isBlocked, onStatusChange }: TicketCardProps) {
  const isTracer = ticket.sliceType !== "wide_refactor";
  const hasBlockers = (ticket.blockedByTitles && ticket.blockedByTitles.length > 0) || (ticket.dependencies && ticket.dependencies.length > 0);

  return (
    <Card variant="static" className="mb-3">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm leading-tight">{ticket.title}</p>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className={PRIORITY_CLASS[ticket.priority]}>
              {ticket.priority}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge
            variant="outline"
            className={
              isTracer
                ? "bg-primary/10 text-primary border-primary/30 text-[10px]"
                : "bg-muted text-muted-foreground text-[10px]"
            }
          >
            {isTracer ? "Tracer Bullet" : "Wide Refactor"}
          </Badge>

          {ticket.status === "todo" && (
            <Badge
              variant="outline"
              className={
                isBlocked
                  ? "bg-destructive/10 text-destructive border-destructive/30 text-[10px]"
                  : "bg-green-500/10 text-green-400 border-green-500/30 text-[10px]"
              }
            >
              {isBlocked ? "Blocked" : "Ready (Frontier)"}
            </Badge>
          )}

          {ticket.estimatedEffort && (
            <Badge variant="outline" className="text-[10px]">
              {ticket.estimatedEffort}
            </Badge>
          )}
          {ticket.evidenceReviewStatus === "needs_review" && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 text-[10px]">Evidence needs review</Badge>
          )}
        </div>

        {hasBlockers && ticket.blockedByTitles && (
          <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded px-2 py-1">
            <span className="font-semibold text-muted-foreground/80">Blocked by:</span>{" "}
            {ticket.blockedByTitles.join(", ")}
          </div>
        )}

        {ticket.claimIds && ticket.claimIds.length > 0 && (
          <div className="text-[11px] text-muted-foreground">Requirements: {ticket.claimIds.join(", ")}</div>
        )}

        {ticket.filesToTouch && ticket.filesToTouch.length > 0 && (
          <div className="text-[11px] text-muted-foreground/80 font-mono truncate">
            {ticket.filesToTouch.length} file{ticket.filesToTouch.length > 1 ? "s" : ""}: {ticket.filesToTouch.slice(0, 2).join(", ")}
            {ticket.filesToTouch.length > 2 && "..."}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {ticket.acceptanceCriteria.length} criteria
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 px-2"
            onClick={() => onStatusChange(ticket._id, STATUS_CYCLE[ticket.status])}
          >
            {STATUS_LABEL[ticket.status]}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
