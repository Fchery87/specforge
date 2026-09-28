"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useAction, useQuery } from "convex/react";
import { GitPullRequest } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckList } from "@/components/checks/check-list";
import { CheckSourceForm, type CheckSourceInput, type PickerState } from "@/components/checks/check-source-form";
import { checkPullRequestAction, listPullRequestsAction } from "@/lib/convex-actions";
import { readableError } from "@/lib/readable-error";

/** The project page's pull-request checks, and the way to run one. */
export function ProjectChecks({ projectId }: { projectId: Id<"projects"> }) {
  const router = useRouter();
  const checks = useQuery(api.verification.listChecks, { projectId });
  const listPullRequests = useAction(listPullRequestsAction);
  const checkPullRequest = useAction(checkPullRequestAction);
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState<PickerState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);

  async function loadPicker() {
    setPicker({ status: "loading" });
    try {
      const result = await listPullRequests({ projectId });
      setPicker(
        result.connected
          ? { status: "ready", repository: result.repository, pullRequests: result.pullRequests }
          : { status: "unconnected", reason: result.reason },
      );
    } catch (caught) {
      setPicker({ status: "error", message: readableError(caught) });
    }
  }

  async function run(source: CheckSourceInput) {
    setError(null);
    try {
      const { checkId } = await checkPullRequest({ projectId, source });
      setOpen(false);
      router.push(`/project/${projectId}/check/${checkId}` as Route);
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  return (
    <section aria-labelledby="checks-heading" className="rounded-lg border border-line bg-surface px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="checks-heading" className="font-display text-title font-semibold text-ink">Pull-request checks</h2>
          <p className="mt-1 max-w-xl text-ui text-muted-foreground">
            Check a pull request against this project&apos;s requirements. Each requirement it touches gets a verdict,
            with the lines it rests on.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            setError(null);
            if (next) void loadPicker();
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <GitPullRequest aria-hidden className="size-4" />
              Check a pull request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Check a pull request</DialogTitle>
              <DialogDescription>
                The check reads the diff and judges it against the requirements it touches. A large one can take a minute.
              </DialogDescription>
            </DialogHeader>
            <CheckSourceForm
              key={picker.status}
              picker={picker}
              onSubmit={run}
              onCancel={() => setOpen(false)}
              error={error}
            />
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-5">
        {checks === undefined ? <Skeleton className="h-10 w-full" /> : <CheckList projectId={projectId} checks={checks} />}
      </div>
    </section>
  );
}
