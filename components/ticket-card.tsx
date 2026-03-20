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
  };
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

export function TicketCard({ ticket, onStatusChange }: TicketCardProps) {
  return (
    <Card variant="static" className="mb-3">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm leading-tight">{ticket.title}</p>
          <Badge variant="outline" className={PRIORITY_CLASS[ticket.priority]}>
            {ticket.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{ticket.acceptanceCriteria.length} criteria</span>
          {ticket.estimatedEffort && (
            <Badge variant="outline" className="text-xs">{ticket.estimatedEffort}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 px-2"
          onClick={() => onStatusChange(ticket._id, STATUS_CYCLE[ticket.status])}
        >
          {STATUS_LABEL[ticket.status]}
        </Button>
      </CardContent>
    </Card>
  );
}
