import { Fragment, type ReactNode } from "react";
import type { StageReport } from "@/lib/quality/stage-report";
import { cn } from "@/lib/utils";

/**
 * The requirement-quality report, on the reading surface.
 *
 * Four dimensions, each a line carrying a count and a word, reported separately and never blended
 * into one number. The four failures are independent and the fix differs for each, so a score would
 * hide which one is wrong. Deliberately not a card, a pill or a colour-only signal: the document
 * language says a status is a word, and a word survives a reader who cannot separate the tones.
 *
 * Pure and presentational. It renders from a `StageReport` alone, which is what lets a server
 * component render it and what keeps it working with no Convex deployment, no claim records and no
 * model credentials.
 */

/**
 * The heading the section is labelled by.
 *
 * A constant rather than `useId`, because this component has no hooks and has to be renderable from a
 * server component. One report per artifact view is the only shape it is used in.
 */
const HEADING_ID = "stage-report-heading";

/** A count, in the face the design gives numbers: mono, aligned, and never a percentage. */
function Count({ value }: { value: number }) {
  return <span className="font-mono tabular-nums">{value}</span>;
}

/** One dimension: its name, and the line that carries its count and its word. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-6">
      <dt className="shrink-0 text-label text-dim sm:w-28">{label}</dt>
      <dd className="text-ui text-ink">{children}</dd>
    </div>
  );
}

/** A clause about a gap, toned as a to-do rather than as a failure. The word is the signal. */
function Gap({ value, word }: { value: number; word: string }) {
  return (
    <>
      ,{" "}
      <span className="text-amber">
        <Count value={value} /> {word}
      </span>
    </>
  );
}

/**
 * The testability classes that make a stage worth a second look, in reading order.
 *
 * `unclassified` is included here and nowhere else: a criterion written before the class existed was
 * never judged, and a report that called it testable would be inventing a judgement nobody made.
 */
const TESTABILITY_GAPS = [
  { key: "unobservable", word: "not observable" },
  { key: "vague", word: "vague" },
  { key: "unclassified", word: "unclassified" },
] as const;

export function StageQualityReport({
  report,
  className,
}: {
  report: StageReport;
  className?: string;
}) {
  const { traceability, testability, coverage, length } = report;
  const overBudgetSections = report.sections.filter((section) => section.overBudget).length;

  return (
    <section aria-labelledby={HEADING_ID} className={cn("border-t border-line pt-4", className)}>
      <h2 id={HEADING_ID} className="text-label text-dim">
        Requirement quality
      </h2>

      <dl className="mt-4 flex flex-col gap-3">
        <Row label="Traceability">
          {traceability.total === 0 ? (
            <span className="text-muted-foreground">
              No requirements recorded yet. Capture evidence against this stage&apos;s answers to
              trace them.
            </span>
          ) : (
            <>
              <Count value={traceability.traced} /> of <Count value={traceability.total} /> requirements
              traced
              {traceability.untraced > 0 ? (
                <Gap value={traceability.untraced} word="untraced" />
              ) : null}
            </>
          )}
        </Row>

        <Row label="Testability">
          {testability.total === 0 ? (
            <span className="text-muted-foreground">No acceptance criteria recorded.</span>
          ) : (
            <>
              <Count value={testability.observable} /> of <Count value={testability.total} /> criteria
              testable
              {TESTABILITY_GAPS.map((gap) =>
                testability[gap.key] > 0 ? (
                  <Fragment key={gap.key}>
                    <Gap value={testability[gap.key]} word={gap.word} />
                  </Fragment>
                ) : null
              )}
            </>
          )}
        </Row>

        <Row label="Coverage">
          <Count value={coverage.sections} /> of{" "}
          <Count value={coverage.sections + coverage.missingSections} /> sections present
          {coverage.emptySections > 0 ? (
            <Gap value={coverage.emptySections} word="empty" />
          ) : null}
          {coverage.missingSections > 0 ? (
            <Gap value={coverage.missingSections} word="missing" />
          ) : null}
          {coverage.missingSectionIds.length > 0 ? (
            <>
              {/* A text node separates the ids from the count before them, because the row's text
                  content is what a reader hears and "1 missingrequirements" would be one word. The
                  span is a block, so the space itself does not show. */}
              {" "}
              <span className="mt-1 block font-mono text-caption text-dim">
                {coverage.missingSectionIds.join(", ")}
              </span>
            </>
          ) : null}
        </Row>

        <Row label="Length">
          <Count value={length.words} />
          {length.budgetWords === 0 ? (
            <> words, no budget recorded</>
          ) : (
            <>
              {" "}
              of <Count value={length.budgetWords} /> words
            </>
          )}
          {/* A stage with no plan has no budget to be over, so `isOverBudget`'s answer for it is not
              reported: the absence of a budget is the fact worth stating there. */}
          {length.overBudget && length.budgetWords > 0 ? (
            <>
              ,{" "}
              <span className="text-amber">over budget</span>
            </>
          ) : null}
          {overBudgetSections > 0 ? (
            <Gap
              value={overBudgetSections}
              word={overBudgetSections === 1 ? "section over budget" : "sections over budget"}
            />
          ) : null}
        </Row>
      </dl>
    </section>
  );
}
