"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TicketCard } from "@/components/ticket-card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type TicketStatus = "todo" | "in_progress" | "done";

interface TicketBoardProps {
  projectId: Id<"projects">;
  phaseId: string;
  artifactId?: Id<"artifacts">;
}

const COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

export function TicketBoard({ projectId, phaseId, artifactId }: TicketBoardProps) {
  const tickets = useQuery(api.tickets.listByPhase, {
    projectId,
    phaseId,
  });
  const updateStatus = useMutation(api.tickets.updateStatus);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseTicketsAction = (api as any)["actions/parseTickets"]?.parseTicketsFromArtifact as any;
  const parseTickets = useAction(parseTicketsAction);
  const [isParsing, setIsParsing] = useState(false);

  async function handleParse() {
    if (!artifactId) return;
    setIsParsing(true);
    try {
      await parseTickets({ artifactId: artifactId as Id<"artifacts">, projectId });
    } catch (error) {
      toast.error("Failed to parse tickets", {
        description: "Could not extract tickets from the artifact. Please try again.",
      });
    } finally {
      setIsParsing(false);
    }
  }

  function handleStatusChange(id: Id<"tickets">, newStatus: TicketStatus) {
    updateStatus({ ticketId: id, status: newStatus });
  }

  if (tickets === undefined) {
    return <div className="text-muted-foreground text-sm">Loading tickets…</div>;
  }

  if (tickets.length === 0 && !artifactId) {
    return (
      <p className="text-sm text-muted-foreground">
        Generate the User Stories artifact first to extract tickets.
      </p>
    );
  }

  if (tickets.length === 0 && artifactId) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-muted-foreground text-sm">No tickets yet. Parse from the User Stories artifact.</p>
        <Button onClick={handleParse} disabled={isParsing}>
          {isParsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Parse Tickets
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map(({ status, label }) => {
        const col = tickets.filter((t) => t.status === status);
        return (
          <div key={status}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
              {label} <span className="text-xs font-normal">({col.length})</span>
            </h3>
            <div>
              {col.map((ticket) => (
                <TicketCard
                  key={ticket._id}
                  ticket={ticket}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {col.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No tickets</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
