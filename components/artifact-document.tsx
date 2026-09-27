"use client";

import { useMemo } from "react";
import { parseSpecOutline, type SpecSection } from "@/lib/spec-outline";
import {
  claimState,
  parseClaimManifest,
  summarizeClaims,
  type ClaimState,
  type ParsedClaim,
} from "@/lib/claims";
import { renderSpecHtml, type SectionMark } from "@/lib/markdown-render";
import { splitContentByMermaid } from "@/lib/mermaid-splitter";
import { MermaidDiagram } from "@/components/ui/mermaid-diagram";
import { useActiveHeading } from "@/hooks/use-active-heading";
import { cn } from "@/lib/utils";

/**
 * The reading surface.
 *
 * A specification renders as a document with anchors and a table of contents. The table of contents
 * doubles as a gap map: a clause whose claims are not settled says so, so a reviewer sees where the
 * holes are before reading a word.
 */

const stateWord: Record<ClaimState, string> = {
  confirmed: "settled",
  proposed: "proposed",
  untraced: "untraced",
};

const stateTone: Record<ClaimState, string> = {
  confirmed: "text-sage",
  proposed: "text-amber",
  untraced: "text-brick",
};

/**
 * Claims per section. Section bodies are non-overlapping, so a claim belongs to exactly one section
 * and nothing needs deduplicating: `parseSpecOutline` ends a body at the next heading of any level.
 */
function claimsBySection(sections: SpecSection[]): Map<string, ParsedClaim[]> {
  return new Map(
    sections.map((section) => [section.id, parseClaimManifest(section.body)])
  );
}

/** One rendered piece of the document: prose with its anchors, or a diagram. */
type DocumentBlock =
  | { kind: "html"; key: string; html: string }
  | { kind: "mermaid"; key: string; chart: string };

/**
 * Render the body in document order, splitting at mermaid fences so a diagram stays a diagram. Each
 * piece renders independently: `renderSpecHtml` derives a heading's id from its own text, so a piece
 * does not need to know where it sits in the document. The earlier cursor-based version did, and it
 * drifted whenever the outline and the renderer disagreed about what counted as a heading.
 */
function renderBlocks(
  markdown: string,
  headingIds: readonly string[],
  claimStates: Readonly<Record<string, ClaimState>>,
  sectionMarks: Readonly<Record<string, SectionMark>>
): DocumentBlock[] {
  return splitContentByMermaid(markdown).map((segment, index) => {
    const key = `${segment.type}-${index}`;

    if (segment.type === "mermaid") {
      return { kind: "mermaid", key, chart: segment.content };
    }

    return {
      kind: "html",
      key,
      html: renderSpecHtml(segment.content, headingIds, claimStates, sectionMarks),
    };
  });
}

export function ArtifactDocument({
  markdown,
  title,
  sectionMarks,
  className,
}: {
  markdown: string;
  title?: string;
  /**
   * Length marks to place on a clause's heading, keyed by anchor id.
   *
   * The caller supplies this rather than the document computing it, because the mark comes from the
   * stage report, which needs the plan and the criteria. A document that could not be measured, such
   * as one from a legacy artifact with no plan, simply renders without marks.
   */
  sectionMarks?: Readonly<Record<string, SectionMark>>;
  className?: string;
}) {
  const outline = useMemo(() => parseSpecOutline(markdown, title), [markdown, title]);
  const ids = useMemo(() => outline.sections.map((section) => section.id), [outline]);
  const owned = useMemo(() => claimsBySection(outline.sections), [outline]);

  const claimStates = useMemo(() => {
    const states: Record<string, ClaimState> = {};
    for (const claims of owned.values()) {
      for (const claim of claims) states[claim.claimId] = claimState(claim);
    }
    return states;
  }, [owned]);

  const blocks = useMemo(
    () => renderBlocks(markdown, ids, claimStates, sectionMarks ?? {}),
    [markdown, ids, claimStates, sectionMarks]
  );

  const activeId = useActiveHeading(ids, { revision: markdown });
  const hasOutline = outline.sections.length > 0;

  return (
    <div className={cn("grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-14", className)}>
      <article className="flex min-w-0 flex-col gap-6">
        {blocks.map((block) =>
          block.kind === "mermaid" ? (
            <MermaidDiagram key={block.key} chart={block.chart} className="w-full" />
          ) : (
            <div
              key={block.key}
              className="document-prose text-ink"
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          )
        )}
      </article>

      {hasOutline ? (
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height)+1.5rem)]">
            <p className="text-caption text-dim">On this page</p>

            <ul className="mt-3 flex flex-col border-l border-line">
              {outline.sections.map((section) => {
                const summary = summarizeClaims(owned.get(section.id) ?? []);
                const active = activeId === section.id;

                return (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={active ? "location" : undefined}
                      className={cn(
                        "-ml-px flex flex-col gap-0.5 border-l-2 py-1.5 pr-2 text-label transition-colors",
                        "duration-(--duration-quick) ease-(--ease-quiet-out)",
                        section.level >= 3 ? "pl-6" : "pl-3",
                        section.level >= 4 && "pl-9",
                        active
                          ? "border-ember text-ink"
                          : "border-transparent text-dim hover:text-ink"
                      )}
                    >
                      <span className="flex items-baseline gap-2">
                        {section.number ? (
                          <span className="font-mono text-caption tabular-nums text-dim">
                            {section.number}
                          </span>
                        ) : null}
                        <span className="min-w-0">{section.title}</span>
                      </span>

                      {summary.total > 0 && summary.state !== "confirmed" ? (
                        <span className={cn("text-caption", stateTone[summary.state])}>
                          {summary.total} {summary.total === 1 ? "claim" : "claims"},{" "}
                          {stateWord[summary.state]}
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
