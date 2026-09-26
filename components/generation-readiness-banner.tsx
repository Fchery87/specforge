import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GenerationReadinessBannerProps {
  ready: boolean;
  className?: string;
}

export function GenerationReadinessBanner({
  ready,
  className,
}: GenerationReadinessBannerProps) {
  if (ready) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "p-4 border border-amber-500/30 bg-amber-500/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
        <span className="text-sm font-medium text-foreground">
          Connect a model to generate specs
        </span>
      </div>
      <Link
        href="/settings"
        className="text-sm font-semibold text-primary hover:underline shrink-0"
      >
        Settings &rarr;
      </Link>
    </div>
  );
}
