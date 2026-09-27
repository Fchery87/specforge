import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function ProjectNotFound() {
  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-5 py-20">
      <div className="w-full max-w-md">
        <p className="flex items-center gap-2 font-mono text-caption text-dim">
          <FileQuestion className="size-3.5" />
          Project not found
        </p>

        <h1 className="mt-3 text-heading font-display font-semibold text-ink">
          This project is not available
        </h1>

        <p className="mt-3 text-body leading-relaxed text-muted-foreground">
          It may have been deleted, or your account may not have access to it. Start a new project if
          you were expecting a blank slate.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/new">Start a project</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
