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
        "p-4 border border-warning/30 bg-warning/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="size-5 text-warning shrink-0" />
        <span className="text-ui font-medium text-ink">
          Connect a model to generate specs
        </span>
      </div>
      <Link
        href="/settings"
        className="text-ui font-semibold text-primary hover:underline shrink-0"
      >
        Open Settings
      </Link>
    </div>
  );
}

/** Why a generate control is off when no model is connected, placed beside the control. */
export function ConnectModelNote({ className }: { className?: string }) {
  return (
    <span className={className}>
      Connect a model in{" "}
      <Link href="/settings" className="font-medium text-ink underline underline-offset-4">
        Settings
      </Link>{" "}
      to generate.
    </span>
  );
}
