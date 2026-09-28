"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CHANGE_KIND_WORDS, type ChangeKind } from "@/lib/changes/format";

export interface NewChangeValues {
  kind: ChangeKind;
  title: string;
  summary: string;
  bug?: { observed: string; expected: string; reproduction: string };
}

const FIELD_LABEL = "mb-1.5 block text-label text-muted-foreground";

/** Feature change or bug fix, what it is, and for a bug, what happened. */
export function NewChangeForm({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (values: NewChangeValues) => Promise<void>;
  onCancel?: () => void;
  error?: string | null;
}) {
  const [kind, setKind] = useState<ChangeKind>("feature");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [observed, setObserved] = useState("");
  const [expected, setExpected] = useState("");
  const [reproduction, setReproduction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bugComplete = Boolean(observed.trim() && expected.trim() && reproduction.trim());
  const valid = Boolean(title.trim() && summary.trim() && (kind === "feature" || bugComplete));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        kind,
        title,
        summary,
        ...(kind === "bugfix" ? { bug: { observed, expected, reproduction } } : {}),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div role="group" aria-label="Kind of change" className="grid grid-cols-2 gap-2">
        {(Object.keys(CHANGE_KIND_WORDS) as ChangeKind[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            onClick={() => setKind(option)}
            className={cn(
              "rounded-sm border px-3 py-2 text-ui transition-colors focus-ring",
              kind === option ? "border-brand bg-brand/5 font-medium text-ink" : "border-line text-muted-foreground hover:text-ink"
            )}
          >
            {CHANGE_KIND_WORDS[option]}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="change-title" className={FIELD_LABEL}>Title</label>
        <Input id="change-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "bugfix" ? "e.g., Invite links show a 404" : "e.g., Invite members with a link"} />
      </div>
      <div>
        <label htmlFor="change-summary" className={FIELD_LABEL}>
          {kind === "bugfix" ? "What is wrong" : "What should change, and why"}
        </label>
        <Textarea id="change-summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>

      {kind === "bugfix" ? (
        <>
          <div>
            <label htmlFor="change-observed" className={FIELD_LABEL}>What happens</label>
            <Textarea id="change-observed" rows={2} value={observed} onChange={(e) => setObserved(e.target.value)} />
          </div>
          <div>
            <label htmlFor="change-expected" className={FIELD_LABEL}>What should happen</label>
            <Textarea id="change-expected" rows={2} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
          <div>
            <label htmlFor="change-reproduction" className={FIELD_LABEL}>Steps to reproduce</label>
            <Textarea id="change-reproduction" rows={3} value={reproduction} onChange={(e) => setReproduction(e.target.value)} />
          </div>
        </>
      ) : null}

      {error ? <p role="alert" className="text-ui text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" disabled={!valid || isSubmitting}>
          {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Start change
        </Button>
      </div>
    </form>
  );
}
