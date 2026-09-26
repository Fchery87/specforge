"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Project page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-5 py-20">
      <div className="w-full max-w-md">
        <p className="flex items-center gap-2 font-mono text-caption text-brick">
          <AlertTriangle className="size-3.5" />
          Project could not load
        </p>

        <h1 className="mt-3 text-heading font-sans font-medium text-ink">
          Something failed while opening this project
        </h1>

        <p className="mt-3 text-body leading-relaxed text-muted-foreground">
          Your work is saved. Try again, and if it keeps failing, the reference below is what to
          report.
        </p>

        {error.digest ? (
          <p className="mt-4 font-mono text-caption tabular-nums text-dim">
            Reference {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
