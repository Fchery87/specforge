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
  confirmed: "text-sage",
  proposed: "text-amber",
  untraced: "text-brick",
};

/** The spine colour. An untraced claim keeps its spine and turns it amber, so a gap is drawn. */
const spineClass: Record<ClaimState, string> = {
  confirmed: "border-line",
  proposed: "border-line",
  untraced: "border-amber/70",
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
      <span className={cn(marginCell, "text-ember")}>{number}</span>
      <h3 className="text-title font-medium text-ink">{title}</h3>
    </div>
  );
}

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
  const firstEvidenceIndex = 0;

  return (
    <section id={claimId} className="flex scroll-mt-24 gap-5 md:gap-6">
      <div className={marginCell}>{number}</div>

      <div
        className={cn(
          "min-w-0 flex-1 border-l pl-5",
          spineClass[effectiveState]
        )}
      >
        <p className="mb-2 flex items-center gap-3">
          <span className="font-mono text-caption tabular-nums text-dim">{claimId}</span>
          <span className={cn("text-caption", claimStateClass[effectiveState])}>
            {claimStateLabel[effectiveState]}
          </span>
        </p>

        <div className="document-prose text-ink">{children}</div>

        {hasEvidence ? (
          <div className="mt-4 flex flex-col">
            {evidence?.map((item, index) => (
              <div
                key={`${item.kind}-${item.source}-${index}`}
                className={cn(
                  "grid grid-cols-[6rem_1fr] gap-x-4 gap-y-1 py-2 md:grid-cols-[7rem_1fr_auto]",
                  index > firstEvidenceIndex && "border-t border-line/60"
                )}
              >
                <span className="text-caption text-dim">{item.kind}</span>
                <span className="font-mono text-caption break-all text-ink">{item.source}</span>
                {item.pin ? (
                  <span className="font-mono text-caption tabular-nums text-dim md:text-right">
                    {item.pin}
                  </span>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-caption text-amber">
            No evidence yet. Answer the question or cite the file that settles it.
          </p>
        )}
      </div>
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
        className={cn("h-px w-6", state === "untraced" ? "bg-amber/70" : "bg-line-strong")}
        aria-hidden
      />
      <span className="font-mono text-caption tabular-nums text-ink">{to}</span>
      <span className={cn("text-caption", claimStateClass[state])}>
        {state === "confirmed" ? "Unblocked" : state === "proposed" ? "Blocked" : "Unassigned"}
      </span>
    </div>
  );
}
