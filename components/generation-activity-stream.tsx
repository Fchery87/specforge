"use client";

import { cn } from "@/lib/utils";
import { Loader2, Check, Search, Brain } from "lucide-react";

interface ActivityEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'context' | 'generating' | 'complete';
}

interface GenerationActivityStreamProps {
  activities: ActivityEntry[];
  isActive: boolean;
}

export function GenerationActivityStream({ activities, isActive }: GenerationActivityStreamProps) {
  if (activities.length === 0) return null;

  const icons = {
    info: Search,
    context: Brain,
    generating: Loader2,
    complete: Check,
  };

  return (
    <div className="space-y-2 p-4 border-2 border-border bg-secondary/10">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Generation Activity
      </h4>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {activities.map((activity, i) => {
          const Icon = icons[activity.type];
          const isLatest = i === activities.length - 1 && isActive;
          return (
            <div key={i} className={cn(
              "flex items-center gap-2 text-sm",
              isLatest ? "text-foreground" : "text-muted-foreground"
            )}>
              <Icon className={cn("w-3 h-3 flex-shrink-0", isLatest && activity.type === 'generating' && "animate-spin")} />
              <span>{activity.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
