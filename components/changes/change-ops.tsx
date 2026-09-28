"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { phaseLabel } from "@/lib/workflow";
import type { ClaimKind, DraftOp } from "@/lib/changes/parse-draft";

export interface ChangeOpDraft {
  reason: string;
  evidenceSourceIds: string[];
  op: DraftOp;
}

export interface ChangeOpView extends ChangeOpDraft {
  _id: string;
  order: number;
  target: { claimId: string; text: string; phaseId: string; live: boolean } | null;
}

export interface ChangeConflict {
  order: number;
  claimId: string | null;
  reason: string;
}

const VERB: Record<DraftOp["type"], string> = {
  add: "Added",
  modify: "Reworded",
  remove: "Removed",
  reaffirm: "Reaffirmed",
};

const VERB_TONE: Record<DraftOp["type"], string> = {
  add: "text-success",
  modify: "text-info",
  remove: "text-destructive",
  reaffirm: "text-muted-foreground",
};

function kindForPhase(phaseId: string): ClaimKind {
  if (phaseId === "stories") return "acceptance_criterion";
  if (phaseId === "constitution") return "decision";
  return "requirement";
}

const FIELD_LABEL = "mb-1.5 block text-label text-muted-foreground";

const toDraft = ({ reason, evidenceSourceIds, op }: ChangeOpView): ChangeOpDraft => ({ reason, evidenceSourceIds, op });

function OpBody({ view }: { view: ChangeOpView }) {
  const { op } = view;
  if (op.type === "add") return <p className="text-body text-ink">{op.text}</p>;
  if (op.type === "modify") {
    return (
      <>
        <p className="text-body text-dim line-through decoration-line-strong">{op.baseText}</p>
        <p className="mt-1 text-body text-ink">{op.text}</p>
      </>
    );
  }
  if (op.type === "remove") return <p className="text-body text-dim line-through decoration-line-strong">{op.baseText}</p>;
  return <p className="text-body text-ink">{op.baseText}</p>;
}

function OpEditor({
  view,
  onDone,
  onCancel,
}: {
  view: ChangeOpView;
  onDone: (next: ChangeOpDraft) => Promise<boolean>;
  onCancel: () => void;
}) {
  const hasText = view.op.type === "add" || view.op.type === "modify";
  const [text, setText] = useState(hasText ? (view.op as { text: string }).text : "");
  const [reason, setReason] = useState(view.reason);
  const valid = Boolean(reason.trim() && (!hasText || text.trim()));

  return (
    <div className="mt-3 flex flex-col gap-3">
      {hasText ? (
        <div>
          <label htmlFor={`${view._id}-wording`} className={FIELD_LABEL}>Wording</label>
          <Textarea id={`${view._id}-wording`} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      ) : null}
      <div>
        <label htmlFor={`${view._id}-reason`} className={FIELD_LABEL}>Reason</label>
        <Textarea id={`${view._id}-reason`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!valid}
          onClick={() => onDone({ ...toDraft(view), reason, op: hasText ? ({ ...view.op, text } as DraftOp) : view.op })}
        >
          Save edit
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function AddRequirement({
  phases,
  onAdd,
}: {
  phases: readonly string[];
  onAdd: (draft: ChangeOpDraft) => Promise<boolean>;
}) {
  const [phaseId, setPhaseId] = useState(phases[0] ?? "");
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const valid = Boolean(phaseId && text.trim() && reason.trim());

  return (
    <form
      aria-label="Add a requirement"
      className="flex max-w-2xl flex-col gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid) return;
        const saved = await onAdd({ reason, evidenceSourceIds: [], op: { type: "add", phaseId, kind: kindForPhase(phaseId), text } });
        if (saved) {
          setText("");
          setReason("");
        }
      }}
    >
      <label className="text-label text-muted-foreground" htmlFor="add-phase">Add a requirement to</label>
      <select
        id="add-phase"
        value={phaseId}
        onChange={(e) => setPhaseId(e.target.value)}
        className="h-9 rounded-sm border border-line bg-surface px-3 text-ui text-ink focus-ring"
      >
        {phases.map((id) => (
          <option key={id} value={id}>{phaseLabel(id)}</option>
        ))}
      </select>
      <div>
        <label htmlFor="add-text" className={FIELD_LABEL}>New requirement</label>
        <Textarea id="add-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div>
        <label htmlFor="add-reason" className={FIELD_LABEL}>Why it is needed</label>
        <Textarea id="add-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={!valid}>Add</Button>
      </div>
    </form>
  );
}

/**
 * A change's operations as a diff against the current requirements. In a draft each one can be
 * reworded, given a new reason or dropped, and requirements can be added; every edit saves the
 * whole list, which is the contract `replaceChangeOps` enforces.
 */
export function ChangeOps({
  ops,
  editable = false,
  conflicts = [],
  phasesWithDocuments = [],
  onSave,
}: {
  ops: readonly ChangeOpView[];
  editable?: boolean;
  conflicts?: readonly ChangeConflict[];
  phasesWithDocuments?: readonly string[];
  onSave?: (next: ChangeOpDraft[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const drafts = ops.map(toDraft);
  /** Resolves to whether the save went through; the caller reports a failure, so it is not rethrown. */
  const save = async (next: ChangeOpDraft[]): Promise<boolean> => {
    try {
      await onSave?.(next);
      setEditing(null);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {ops.length === 0 ? (
        <p className="text-ui text-dim">No edits yet. Draft them from the description, or add a requirement below.</p>
      ) : (
        <ol aria-label="Edits" className="divide-y divide-line rounded-lg border border-line bg-surface">
          {ops.map((view, index) => {
            const conflict = conflicts.find((item) => item.order === view.order);
            const where = view.op.type === "add" ? phaseLabel(view.op.phaseId) : view.target?.claimId ?? "Unknown requirement";
            return (
              <li key={view._id} className={cn("px-5 py-4", conflict && "bg-destructive/5")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-label">
                    <span className={cn("font-semibold", VERB_TONE[view.op.type])}>{VERB[view.op.type]}</span>
                    <span className={cn("ml-2 text-dim", view.op.type !== "add" && "font-mono")}>{where}</span>
                  </p>
                  {editable && editing !== view._id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(view._id)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => save(drafts.filter((_, i) => i !== index))}>
                        Drop
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2">
                  <OpBody view={view} />
                </div>
                <p className="mt-2 text-ui text-muted-foreground">
                  <span className="text-dim">Why: </span>
                  {view.reason}
                </p>
                {conflict ? (
                  <p role="alert" className="mt-2 text-ui text-destructive">{conflict.reason}</p>
                ) : null}
                {editing === view._id ? (
                  <OpEditor
                    view={view}
                    onCancel={() => setEditing(null)}
                    onDone={(next) => save(drafts.map((draft, i) => (i === index ? next : draft)))}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {editable && phasesWithDocuments.length > 0 ? (
        <AddRequirement phases={phasesWithDocuments} onAdd={(draft) => save([...drafts, draft])} />
      ) : null}
    </div>
  );
}
