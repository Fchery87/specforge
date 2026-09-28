"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { draftChangeAction, getAllProjectArtifactsAction } from "@/lib/convex-actions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectNav } from "@/components/project-nav";
import { ChangeOps, type ChangeConflict, type ChangeOpDraft, type ChangeOpView } from "@/components/changes/change-ops";
import { CHANGE_KIND_WORDS, CHANGE_STATUS_WORDS, formatChangeId } from "@/lib/changes/format";
import { MODE_POLICIES, PHASE_ORDER, type ProjectMode } from "@/lib/workflow";
import { readableError } from "@/lib/readable-error";

type Pending = "draft" | "apply" | "abandon" | null;

function toMutationOps(drafts: ChangeOpDraft[]) {
  return drafts.map(({ reason, evidenceSourceIds, op }) => ({
    reason,
    evidenceSourceIds: evidenceSourceIds as Id<"evidenceSources">[],
    op: op.type === "add" ? op : { ...op, claim: op.claim as Id<"claims"> },
  }));
}

export default function ChangePage() {
  const params = useParams<{ id: string; changeId: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const projectId = params.id as Id<"projects">;
  const changeId = params.changeId as Id<"changes">;
  const ready = isLoaded && isSignedIn;

  const project = useQuery(api.projects.getProject, ready ? { projectId } : "skip");
  const phases = useQuery(api.projects.getProjectPhases, ready ? { projectId } : "skip");
  const artifacts = useQuery(getAllProjectArtifactsAction, ready ? { projectId } : "skip");
  const data = useQuery(api.changes.getChange, ready ? { changeId } : "skip");

  const draftChange = useAction(draftChangeAction);
  const applyChange = useMutation(api.changes.applyChange);
  const abandonChange = useMutation(api.changes.abandonChange);
  const replaceChangeOps = useMutation(api.changes.replaceChangeOps);

  const [pending, setPending] = useState<Pending>(null);
  const [confirming, setConfirming] = useState<Exclude<Pending, null> | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<ChangeConflict[]>([]);

  if (!project || !data || phases === undefined) {
    return (
      <main className="page-container py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </main>
    );
  }

  const { change } = data;
  const ops: ChangeOpView[] = data.ops;
  const changeName = formatChangeId(change.changeNumber);
  const isDraft = change.status === "draft";
  const phasesWithDocuments = PHASE_ORDER.filter((phaseId) => (artifacts ?? []).some((a) => a.phaseId === phaseId));

  async function run(kind: Exclude<Pending, null>) {
    setConfirming(null);
    setPending(kind);
    try {
      if (kind === "draft") {
        const result = await draftChange({ changeId });
        setNotes(result.notes);
        setConflicts([]);
        toast.success(`Drafted ${result.operations} ${result.operations === 1 ? "edit" : "edits"}`);
      } else if (kind === "apply") {
        const result = await applyChange({ changeId });
        if (result.status === "conflict") {
          setConflicts(result.conflicts);
        } else {
          setConflicts([]);
          toast.success(`${changeName} applied. Regenerate the documents it touched to bring them up to date.`);
        }
      } else {
        await abandonChange({ changeId });
        toast.message(`${changeName} abandoned`);
      }
    } catch (caught) {
      toast.error(readableError(caught));
    } finally {
      setPending(null);
    }
  }

  async function saveOps(next: ChangeOpDraft[]) {
    try {
      await replaceChangeOps({ changeId, ops: toMutationOps(next) });
      setConflicts([]);
    } catch (caught) {
      toast.error(readableError(caught));
      throw caught;
    }
  }

  return (
    <main className="min-h-[calc(100vh-var(--header-height))]">
      <div className="page-container py-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-12">
        <ProjectNav
          projectId={projectId}
          title={project.title}
          modeLabel={MODE_POLICIES[(project.mode ?? "full") as ProjectMode]?.label ?? "Full"}
          phases={phases}
          skippedPhases={project.skippedPhases ?? []}
          currentLabel={changeName}
        />

        <div className="min-w-0 pt-6 lg:pt-0">
          <p className="text-label text-dim">
            {CHANGE_KIND_WORDS[change.kind]} <span className="font-mono">{changeName}</span>
          </p>
          <h1 className="mt-2 font-display text-heading font-semibold text-ink">{change.title}</h1>
          <p className="mt-2 text-label text-muted-foreground">
            {CHANGE_STATUS_WORDS[change.status]}
            {change.appliedAt ? ` on ${new Date(change.appliedAt).toLocaleDateString()}` : ""}
          </p>
          <p className="mt-4 max-w-xl text-body text-muted-foreground">{change.summary}</p>

          {change.bug ? (
            <dl className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <dt className="text-label text-dim">What happens</dt>
              <dd className="text-ui text-ink">{change.bug.observed}</dd>
              <dt className="text-label text-dim">What should happen</dt>
              <dd className="text-ui text-ink">{change.bug.expected}</dd>
              <dt className="text-label text-dim">Steps to reproduce</dt>
              <dd className="whitespace-pre-line text-ui text-ink">{change.bug.reproduction}</dd>
            </dl>
          ) : null}

          {isDraft ? (
            <div className="mt-8 flex flex-wrap gap-2">
              <Button
                variant={ops.length ? "outline" : "default"}
                disabled={pending !== null}
                onClick={() => (ops.length ? setConfirming("draft") : run("draft"))}
              >
                {pending === "draft" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                {ops.length ? "Draft again" : "Draft edits"}
              </Button>
              {ops.length ? (
                <Button disabled={pending !== null} onClick={() => setConfirming("apply")}>
                  {pending === "apply" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                  Apply change
                </Button>
              ) : null}
              <Button variant="ghost" disabled={pending !== null} onClick={() => setConfirming("abandon")}>
                Abandon
              </Button>
            </div>
          ) : null}

          {conflicts.length ? (
            <div role="alert" className="mt-6 max-w-2xl rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-4">
              <p className="text-ui font-semibold text-ink">Nothing was applied.</p>
              <p className="mt-1 text-ui text-muted-foreground">
                {conflicts.length === 1 ? "One edit no longer matches" : `${conflicts.length} edits no longer match`} the
                current requirements. Draft again to rebuild the edits against them, or drop the marked edits.
              </p>
            </div>
          ) : null}

          {notes.length ? (
            <div className="mt-6 max-w-2xl rounded-lg border border-line bg-void px-5 py-4">
              <p className="text-label text-dim">From the draft</p>
              <ul className="mt-2 list-disc pl-5 text-ui text-muted-foreground">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <section aria-labelledby="edits-heading" className="mt-10">
            <h2 id="edits-heading" className="font-display text-title font-semibold text-ink">Edits to the requirements</h2>
            <div className="mt-4">
              <ChangeOps
                ops={ops}
                editable={isDraft && pending === null}
                conflicts={conflicts}
                phasesWithDocuments={phasesWithDocuments}
                onSave={saveOps}
              />
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirming === "apply"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Apply ${changeName}?`}
        description="The requirements are updated now. Documents whose requirements change are marked out of date until you regenerate them. An applied change cannot be edited."
        confirmLabel="Apply change"
        onConfirm={() => run("apply")}
      />
      <ConfirmDialog
        open={confirming === "draft"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Draft the edits again?"
        description="A new draft replaces the current edits, including any you changed by hand."
        confirmLabel="Draft again"
        onConfirm={() => run("draft")}
      />
      <ConfirmDialog
        open={confirming === "abandon"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Abandon ${changeName}?`}
        description="The change stays on record as abandoned and can no longer be edited or applied."
        confirmLabel="Abandon"
        variant="destructive"
        onConfirm={() => run("abandon")}
      />
    </main>
  );
}
