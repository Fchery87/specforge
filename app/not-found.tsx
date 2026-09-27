import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-5 py-20">
      <div className="w-full max-w-md">
        <p className="font-mono text-caption tabular-nums text-dim">404</p>

        <h1 className="mt-3 text-heading font-display font-semibold text-ink">
          This page does not exist
        </h1>

        <p className="mt-3 text-body leading-relaxed text-muted-foreground">
          The address may be mistyped, or the page may have moved since it was linked.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
