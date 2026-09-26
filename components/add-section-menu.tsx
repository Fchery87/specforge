"use client";

import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { phaseLabel } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export interface AddSectionMenuProps {
  /** The phases that are currently skipped, in workflow order. */
  skippedPhases: readonly string[];
  onEnable: (phaseId: string) => void;
  className?: string;
}

/**
 * The one control that brings a skipped phase back into the workflow.
 *
 * The stepper describes the workflow and the next action says what to do next, so re-enabling is a
 * control rather than a fourth description of the same stages.
 */
export function AddSectionMenu({ skippedPhases, onEnable, className }: AddSectionMenuProps) {
  if (skippedPhases.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5", className)}>
          <Plus aria-hidden className="size-3.5" />
          Add a section
          <ChevronDown aria-hidden className="size-3 text-dim" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {skippedPhases.map((phaseId) => (
          <DropdownMenuItem
            key={phaseId}
            onClick={() => onEnable(phaseId)}
            className="cursor-pointer"
          >
            <Plus aria-hidden className="size-3.5 text-dim" />
            {phaseLabel(phaseId)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
