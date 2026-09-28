"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type CheckSourceInput =
  | { kind: "pull_request"; number: number }
  | { kind: "range"; base: string; head: string }
  | { kind: "pasted"; diff: string };

export interface PullRequestOption {
  number: number;
  title: string;
  state: "open" | "merged";
  author: string;
}

/** What the picker knows about the connected repository. */
export type PickerState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unconnected"; reason: string }
  | { status: "ready"; repository: string; pullRequests: PullRequestOption[] };

type Kind = CheckSourceInput["kind"];

const KIND_WORDS: Record<Kind, string> = { pull_request: "Pull request", range: "Commit range", pasted: "Paste a diff" };
const FIELD_LABEL = "mb-1.5 block text-label text-muted-foreground";

/** Choose what to check: a pull request from the connected repository, a commit range, or a pasted diff. */
export function CheckSourceForm({
  picker,
  onSubmit,
  onCancel,
  error,
}: {
  picker: PickerState;
  onSubmit: (source: CheckSourceInput) => Promise<void>;
  onCancel?: () => void;
  error?: string | null;
}) {
  const connected = picker.status === "ready";
  const [kind, setKind] = useState<Kind>(picker.status === "unconnected" ? "pasted" : "pull_request");
  const [number, setNumber] = useState<number | null>(null);
  const [base, setBase] = useState("");
  const [head, setHead] = useState("");
  const [diff, setDiff] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveKind: Kind = !connected && kind !== "pasted" && picker.status !== "loading" ? "pasted" : kind;
  const source: CheckSourceInput | null =
    effectiveKind === "pull_request"
      ? number !== null && connected ? { kind: "pull_request", number } : null
      : effectiveKind === "range"
        ? base.trim() && head.trim() && connected ? { kind: "range", base: base.trim(), head: head.trim() } : null
        : diff.trim() ? { kind: "pasted", diff } : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!source || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(source);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div role="group" aria-label="What to check" className="grid grid-cols-3 gap-2">
        {(Object.keys(KIND_WORDS) as Kind[]).map((option) => {
          const unavailable = option !== "pasted" && (picker.status === "unconnected" || picker.status === "error");
          return (
            <button
              key={option}
              type="button"
              aria-pressed={effectiveKind === option}
              disabled={unavailable}
              onClick={() => setKind(option)}
              className={cn(
                "rounded-sm border px-2 py-2 text-ui transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-50",
                effectiveKind === option ? "border-brand bg-brand/5 font-medium text-ink" : "border-line text-muted-foreground hover:text-ink",
              )}
            >
              {KIND_WORDS[option]}
            </button>
          );
        })}
      </div>

      {picker.status === "unconnected" || picker.status === "error" ? (
        <p className="text-ui text-muted-foreground">
          {picker.status === "unconnected" ? picker.reason : picker.message} To pick a pull request, connect the
          project&apos;s repository on the project page and GitHub in Settings. A pasted diff works without either.
        </p>
      ) : null}

      {effectiveKind === "pull_request" ? (
        picker.status === "loading" ? (
          <p className="flex items-center gap-2 text-ui text-dim">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Reading pull requests…
          </p>
        ) : picker.status === "ready" && picker.pullRequests.length === 0 ? (
          <p className="text-ui text-dim">{picker.repository} has no open or recently merged pull requests.</p>
        ) : picker.status === "ready" ? (
          <fieldset>
            <legend className={FIELD_LABEL}>Pull requests in {picker.repository}</legend>
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-sm border border-line">
              {picker.pullRequests.map((pull) => (
                <li key={pull.number}>
                  <label className="flex cursor-pointer items-baseline gap-3 px-3 py-2.5 text-ui hover:bg-raised has-[:checked]:bg-brand/5">
                    <input
                      type="radio"
                      name="pull-request"
                      className="translate-y-0.5 accent-brand"
                      aria-label={`#${pull.number} ${pull.title}, ${pull.state === "open" ? "open" : "merged"}`}
                      checked={number === pull.number}
                      onChange={() => setNumber(pull.number)}
                    />
                    <span className="font-mono text-caption text-dim">#{pull.number}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{pull.title}</span>
                    <span className="shrink-0 text-caption text-dim">{pull.state === "open" ? "Open" : "Merged"}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null
      ) : null}

      {effectiveKind === "range" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="check-base" className={FIELD_LABEL}>Base</label>
            <Input id="check-base" value={base} onChange={(e) => setBase(e.target.value)} placeholder="main" />
          </div>
          <div>
            <label htmlFor="check-head" className={FIELD_LABEL}>Head</label>
            <Input id="check-head" value={head} onChange={(e) => setHead(e.target.value)} placeholder="feature/invite-links" />
          </div>
          <p className="text-caption text-dim sm:col-span-2">Branches, tags or commit SHAs. The check reads what head adds since it left base.</p>
        </div>
      ) : null}

      {effectiveKind === "pasted" ? (
        <div>
          <label htmlFor="check-diff" className={FIELD_LABEL}>Diff</label>
          <Textarea
            id="check-diff"
            rows={8}
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
            className="font-mono text-caption"
            placeholder="The output of git diff main...HEAD"
          />
        </div>
      ) : null}

      <p className="text-caption text-dim">
        Mention REQ- or CHG- IDs in the pull request&apos;s title, description or commits to check exactly those
        requirements. Otherwise the check picks the ones the diff touches.
      </p>

      {error ? <p role="alert" className="text-ui text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
        <Button type="submit" disabled={!source || isSubmitting}>
          {isSubmitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {isSubmitting ? "Checking…" : "Run check"}
        </Button>
      </div>
    </form>
  );
}
