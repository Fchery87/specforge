import { notFound } from "next/navigation";
import { ArtifactDocument } from "@/components/artifact-document";
import { StageQualityReport } from "@/components/stage-report";
import type { ParsedClaim } from "@/lib/claims";
import { getSectionPlansForPhase } from "@/lib/llm/section-plans";
import { sectionMarksFor } from "@/lib/markdown-render";
import { buildStageReport } from "@/lib/quality/stage-report";
import { classifyCriterion } from "@/lib/validation/acceptance-criteria";

export const metadata = {
  title: "Design preview | SpecForge",
  robots: { index: false, follow: false },
};

const FIXTURE = [
  "# Atlas product requirements",
  "",
  "Atlas keeps a project's evidence in one place. This document is the source of truth for the",
  "requirements behind it, and every clause below is traceable to the interview answer, rule, or",
  "committed file that justifies it.",
  "",
  "## 1. Scope",
  "",
  "Atlas covers project intake, review, and handoff. It does not cover deployment.",
  "",
  "## 3.3 Roles and permissions",
  "",
  "### 3.3.1 Archive a project",
  "",
  "A workspace member with the editor role may archive a project. Archiving sets the project status",
  "to archived, keeps every artifact readable, and writes one audit event. An archived project",
  "accepts no new generation runs.",
  "",
  "| Field | Type | Required | Notes |",
  "| --- | --- | --- | --- |",
  "| status | enum | yes | active, archived |",
  "| archivedAt | timestamp | on archive | set once, never rewritten |",
  "",
  "### 3.3.2 Restore a project",
  "",
  "Restoring requires an owner. It writes the same audit event as archiving, so the two operations",
  "are symmetric in the log.",
  "",
  "```ts",
  "export function canArchive(role: Role): boolean {",
  "  return role === 'editor' || role === 'owner'",
  "}",
  "```",
  "",
  "## 5.2 Archive invariant",
  "",
  "An archived project never loses a readable artifact. Deletion is out of scope and no code path",
  "removes an artifact record.",
  "",
  "## Requirement Traceability",
  "",
  "Review status and evidence links are advisory project records.",
  "",
  "- **C-014** [confirmed; reviewed]: A member with the editor role may archive a project. — Evidence: lib/authz.ts (4f2a91c, supports); Who may archive a project (2026-09-22, supports)",
  "- **C-015** [proposed; reviewed]: Restoring an archived project requires an owner. — Evidence: lib/projects.ts (9b1e0d4, partial)",
  "- **C-016** [unresolved; pending]: Audit events are retained for one year. — Evidence not captured",
  "- **C-017** [confirmed; reviewed]: An archived project keeps its artifacts readable. — Evidence: lib/artifacts.ts (2c7e551, supports)",
].join("\n");

/**
 * A sentence repeated to push one section past its budget.
 *
 * The PRD's second section is budgeted 1500 tokens, which is a 1000-word budget, so an over-budget
 * mark needs more than 1200 words under it. Writing that much real prose into a fixture would bury
 * the two marks this example exists to show, so the padding is mechanical and labelled here. A real
 * document reaches the same state with prose.
 */
function pad(sentence: string, times: number): string {
  return Array.from({ length: times }, () => sentence).join(" ");
}

const PAD_SENTENCE =
  "Atlas stores every requirement as a claim with the answer or file that justifies it.";

/**
 * Claim records for the previewed stage.
 *
 * Traceability reads these rather than the claim bullets in the markdown, exactly as the real read
 * path does, so the preview carries the same split the product has: the text holds a bullet and the
 * records decide what is traced.
 */
const PREVIEW_CLAIMS: ParsedClaim[] = [
  {
    claimId: "C-014",
    decisionStatus: "confirmed",
    reviewStatus: "reviewed",
    text: "An editor may archive a project.",
    evidence: [{ locator: "lib/authz.ts", revision: "4f2a91c", support: "supports" }],
    hasEvidence: true,
  },
  {
    claimId: "C-015",
    decisionStatus: "unresolved",
    reviewStatus: "pending",
    text: "Audit events are retained for one year.",
    evidence: [],
    hasEvidence: false,
  },
];

const PREVIEW_CRITERIA = [
  "Archiving a project returns 204 for an editor.",
  "Archiving should be fast.",
  "Handle edge cases.",
  "The archive endpoint stays available during a deploy.",
];

/** The PRD stage this second example is measured as. */
const PREVIEW_PHASE = "prd";

/**
 * A second example, measured the way the product measures it.
 *
 * The first example has headings that match no section plan, so it can only ever show the reader a
 * document. This one is written against the real PRD plan and measured by the real `buildStageReport`,
 * which is the only way the report and the section marks can be checked in this repository: it needs
 * no Convex deployment, no model credentials and no generated project. Its headings are numbered
 * because a numbered heading anchors as the slug of its whole text while the plan knows the section by
 * its title, and a mark has to land on the heading the reader sees.
 */
const PREVIEW_HEADINGS = [
  "# Atlas product requirements",
  "",
  "Atlas turns an interview into a specification whose every clause a reviewer can trace.",
  "",
  "## 1. Executive Summary",
  "",
  "Atlas keeps requirements and the evidence behind them in one document.",
  "",
  "- **C-014** [confirmed; reviewed]: An editor may archive a project. — Evidence: lib/authz.ts (4f2a91c, supports)",
  "",
  "## 2. Problem Statement",
  "",
  "Requirements written before their evidence is captured drift away from the answers that produced",
  "them, and a reader cannot tell which clauses are safe to build from.",
  "",
  pad(PAD_SENTENCE, 85),
  "",
  "## 3. Goals and Objectives",
  "",
  "Atlas should be fast and easy to use, and the team should feel confident in the output.",
].join("\n");

const PREVIEW_PLAN = getSectionPlansForPhase(PREVIEW_PHASE);

const PREVIEW_REPORT = buildStageReport({
  markdown: PREVIEW_HEADINGS,
  claims: PREVIEW_CLAIMS,
  sectionPlan: PREVIEW_PLAN,
  criteria: PREVIEW_CRITERIA,
  // The first three criteria are classed the way the ticket parser classes them; the fourth has no
  // stored class, which is how a criterion written before the class existed reads.
  criterionClassList: PREVIEW_CRITERIA.slice(0, 3).map(classifyCriterion),
});

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="page-container py-10">
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-caption text-dim">Design preview, development only</p>
        <h1 className="mt-2 text-heading font-sans font-medium text-ink">
          The reading surface
        </h1>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-muted-foreground">
          An artifact rendered as a document. The table of contents doubles as a gap map, so an
          unsettled clause is visible before you read it.
        </p>
      </div>

      <ArtifactDocument markdown={FIXTURE} title="Atlas product requirements" />

      <section className="mt-16 border-t border-line pt-8">
        <p className="text-caption text-dim">Second example, a measured stage</p>
        <h2 className="mt-2 text-title font-medium text-ink">The report and the section marks</h2>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-muted-foreground">
          The same reading surface with the requirement-quality report above it and a section marked
          where it is: one over budget, one empty, and one heading the plan does not know about.
          Measured by the real report from the real PRD plan, with no deployment and no credentials.
        </p>

        <div className="mt-8">
          <StageQualityReport report={PREVIEW_REPORT} />

          <div className="mt-8">
            <ArtifactDocument
              markdown={PREVIEW_HEADINGS}
              title="Atlas product requirements"
              sectionMarks={sectionMarksFor(
                PREVIEW_REPORT.sections.filter((section) => section.phaseId === PREVIEW_PHASE)
              )}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
