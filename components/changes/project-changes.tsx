"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
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
import { ChangeList } from "@/components/changes/change-list";
import { NewChangeForm, type NewChangeValues } from "@/components/changes/new-change-form";
import { readableError } from "@/lib/readable-error";

/** The project page's record of feature changes and bug fixes, and the way to start one. */
export function ProjectChanges({ projectId }: { projectId: Id<"projects"> }) {
  const router = useRouter();
  const changes = useQuery(api.changes.listChanges, { projectId });
  const createChange = useMutation(api.changes.createChange);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(values: NewChangeValues) {
    setError(null);
    try {
      const changeId = await createChange({ projectId, ...values });
      setOpen(false);
      router.push(`/project/${projectId}/change/${changeId}` as Route);
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  return (
    <section aria-labelledby="changes-heading" className="rounded-lg border border-line bg-surface px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="changes-heading" className="font-display text-title font-semibold text-ink">Changes</h2>
          <p className="mt-1 max-w-xl text-ui text-muted-foreground">
            Feature changes and bug fixes, written as edits to this project&apos;s requirements.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus aria-hidden className="size-4" />
              New change
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New change</DialogTitle>
              <DialogDescription>
                Describe what should change. SpecForge drafts the edits to the requirements for you to review.
              </DialogDescription>
            </DialogHeader>
            <NewChangeForm onSubmit={start} onCancel={() => setOpen(false)} error={error} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-5">
        {changes === undefined ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <ChangeList projectId={projectId} changes={changes} />
        )}
      </div>
    </section>
  );
}
