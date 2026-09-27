import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The document language.
 *
 * A specification is rendered as a document with a margin column, not as cards. Every clause is
 * numbered, carries a claim ID, and shows its evidence in a spine that hangs off the clause body.
 * One notation carries two kinds of trace: evidence for a claim, and a blocking edge for a task.
 *
 * The margin column is 64px on wide viewports and collapses inline below `md`.
 */

export type ClaimState = "confirmed" | "proposed" | "untraced";

const claimStateLabel: Record<ClaimState, string> = {
  confirmed: "Confirmed",
  proposed: "Proposed",
  untraced: "Untraced",
};

const claimStateClass: Record<ClaimState, string> = {
  confirmed: "text-success",
  proposed: "text-warning",
  untraced: "text-destructive",
};

/** The spine colour, drawn only where the strip stacks under the body. */
const spineClass: Record<ClaimState, string> = {
  confirmed: "border-line",
  proposed: "border-warning",
  untraced: "border-destructive",
};

export interface EvidenceItem {
  /** What kind of source this is: an interview answer, a file, a commit, a rule. */
  kind: string;
  /** The source itself. A path, a question, a rule identifier. */
  source: string;
  /** The pin that makes it verifiable: a commit SHA, a date, a revision. */
  pin?: string;
}

const marginCell = "w-14 shrink-0 pt-0.5 font-mono text-caption tabular-nums text-dim md:w-16";

export function SpecDocument({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-10", className)}>{children}</div>;
}

export function SpecSectionHeading({
  number,
  title,
  id,
}: {
  number: string;
  title: string;
  id?: string;
}) {
  return (
    <div id={id} className="flex scroll-mt-24 gap-5 md:gap-6">
      <span className={cn(marginCell, "text-brand")}>{number}</span>
      <h3 className="text-title font-medium text-ink">{title}</h3>
    </div>
  );
}

const hallmarkState: Record<ClaimState, string> = {
  confirmed: "hallmark-struck",
  proposed: "hallmark-review",
  untraced: "hallmark-missing",
};

/**
 * A clause in three columns: its number in the margin, its body, and its hallmarks, the stamped
 * strip of claim ID, evidence and state. Below `md` the strip drops under the body.
 */
export function SpecClause({
  number,
  claimId,
  state,
  children,
  evidence,
}: {
  number: string;
  claimId: string;
  state: ClaimState;
  children: ReactNode;
  evidence?: EvidenceItem[];
}) {
  const hasEvidence = Boolean(evidence && evidence.length > 0);
  const effectiveState: ClaimState = hasEvidence ? state : "untraced";

  return (
    <section
      id={claimId}
      className="grid scroll-mt-24 gap-x-6 gap-y-3 border-t border-line pt-6 md:grid-cols-[4rem_minmax(0,1fr)_17rem]"
    >
      <div className={marginCell}>{number}</div>

      <div className={cn("min-w-0 border-l-2 pl-5 md:border-l-0 md:pl-0", spineClass[effectiveState])}>
        <div className="document-prose text-ink">{children}</div>
        {hasEvidence ? null : (
          <p className="mt-3 text-caption text-destructive">
            No evidence yet. Answer the question or cite the file that settles it.
          </p>
        )}
      </div>

      <ul
        aria-label={`Claim ${claimId}, ${claimStateLabel[effectiveState].toLowerCase()}`}
        className="flex flex-wrap content-start gap-1 md:pt-1"
      >
        <li className={cn("hallmark", effectiveState === "confirmed" && "hallmark-struck")}>
          {claimId}
        </li>
        {evidence?.map((item, index) => (
          <li key={`${item.kind}-${item.source}-${index}`} className="hallmark" title={item.kind}>
            <span className="sr-only">{item.kind}: </span>
            {item.source}
            {item.pin ? <span className="text-dim">{item.pin}</span> : null}
          </li>
        ))}
        <li className={cn("hallmark", hallmarkState[effectiveState])}>
          {claimStateLabel[effectiveState]}
        </li>
      </ul>
    </section>
  );
}

/**
 * A blocking edge between two tracer bullets. Same spine, different vocabulary, so the reader
 * learns one notation.
 */
export function TracerEdge({
  from,
  to,
  state,
}: {
  from: string;
  to: string;
  state: ClaimState;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-caption tabular-nums text-dim">{from}</span>
      <span
        className={cn("h-px w-6", state === "untraced" ? "bg-warning/70" : "bg-line-strong")}
        aria-hidden
      />
      <span className="font-mono text-caption tabular-nums text-ink">{to}</span>
      <span className={cn("text-caption", claimStateClass[state])}>
        {state === "confirmed" ? "Unblocked" : state === "proposed" ? "Blocked" : "Unassigned"}
      </span>
    </div>
  );
}
