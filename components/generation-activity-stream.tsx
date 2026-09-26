"use client";

import { useEffect, useRef } from "react";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities.length]);

  if (activities.length === 0) return null;

  const icons = {
    info: Search,
    context: Brain,
    generating: Loader2,
    complete: Check,
  };

  return (
    <div className="space-y-2 p-4 border border-line bg-raised/10">
      <h4 className="text-caption font-medium text-muted-foreground">
        Generation Activity
      </h4>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {activities.map((activity, i) => {
          const Icon = icons[activity.type];
          const isLatest = i === activities.length - 1 && isActive;
          return (
            <div key={i} className={cn(
              "flex items-center gap-2 text-ui",
              isLatest ? "text-ink" : "text-muted-foreground"
            )}>
              <Icon className={cn("size-3 flex-shrink-0", isLatest && activity.type === 'generating' && "animate-spin")} />
              <span>{activity.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
