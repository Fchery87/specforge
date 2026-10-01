import { notFound } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { ArtifactDocument } from "@/components/artifact-document";
import { ProjectCard } from "@/components/dashboard/project-card";
import { NextActionPanel } from "@/components/next-action-panel";
import { PhaseLedger } from "@/components/phase-ledger";
import { ProjectNav } from "@/components/project-nav";
import { ChangePreviews } from "./change-previews";
import { CheckPreviews } from "./check-previews";
import { QuestionPreviews } from "./question-previews";
import { StageStepper } from "@/components/stage-stepper";
import { StageQualityReport } from "@/components/stage-report";
import type { ParsedClaim } from "@/lib/claims";
import { sectionsFor } from "@/lib/specification/phase-sections";
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
  "## 2. Success Metrics",
  "",
  "Requirements written before their evidence is captured drift away from the answers that produced",
  "them, and a reader cannot tell which clauses are safe to build from.",
  "",
  pad(PAD_SENTENCE, 85),
].join("\n");

const PREVIEW_PLAN = sectionsFor(PREVIEW_PHASE);

const PREVIEW_REPORT = buildStageReport({
  documents: [{ phaseId: PREVIEW_PHASE, markdown: PREVIEW_HEADINGS }],
  claims: PREVIEW_CLAIMS,
  sectionPlan: PREVIEW_PLAN,
  criteria: PREVIEW_CRITERIA,
  // The first three criteria are classed the way the ticket parser classes them; the fourth has no
  // stored class, which is how a criterion written before the class existed reads.
  criterionClassList: PREVIEW_CRITERIA.slice(0, 3).map(classifyCriterion),
});

/** A project part-way through Design, with two untraced claims left in its requirements. */
const WORKSPACE_PHASES = [
  { phaseId: "constitution", status: "ready" as const },
  { phaseId: "brief", status: "ready" as const },
  { phaseId: "prd", status: "ready" as const },
  { phaseId: "domainModel", status: "generating" as const },
  { phaseId: "specs", status: "pending" as const },
  { phaseId: "artifacts", status: "pending" as const },
  { phaseId: "stories", status: "pending" as const },
];

const WORKSPACE_QUALITY = { requirements: { untraced: 2, unobservable: 0, vague: 0 } };

const HOUR = 3_600_000;
const PREVIEW_NOW = Date.UTC(2026, 8, 27, 12);

const PREVIEW_PROJECTS = [
  {
    project: {
      _id: "preview-atlas" as Id<"projects">,
      title: "Atlas",
      description: "Evidence workspace for agencies",
      status: "active" as const,
      mode: "full" as const,
      createdAt: PREVIEW_NOW - 200 * HOUR,
      updatedAt: PREVIEW_NOW - HOUR / 15,
    },
    phases: WORKSPACE_PHASES,
    completed: 3,
    pinned: true,
  },
  {
    project: {
      _id: "preview-ledgerline" as Id<"projects">,
      title: "Ledgerline",
      description: "Invoice reconciliation API",
      status: "complete" as const,
      mode: "backend" as const,
      createdAt: PREVIEW_NOW - 400 * HOUR,
      updatedAt: PREVIEW_NOW - 26 * HOUR,
    },
    phases: WORKSPACE_PHASES.map((phase) => ({ ...phase, status: "ready" as const })),
    completed: 8,
    pinned: false,
  },
  {
    project: {
      _id: "preview-tidepool" as Id<"projects">,
      title: "Tidepool",
      description: "Shift scheduling for clinics",
      status: "draft" as const,
      mode: "quick" as const,
      createdAt: PREVIEW_NOW - 300 * HOUR,
      updatedAt: PREVIEW_NOW - 190 * HOUR,
    },
    phases: [
      { phaseId: "constitution", status: "ready" as const },
      { phaseId: "brief", status: "pending" as const },
    ],
    completed: 1,
    pinned: false,
  },
];

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="page-container py-10">
      <div className="mb-8 border-b border-line pb-6">
        <p className="text-caption text-dim">Design preview, development only</p>
        <h1 className="mt-2 text-heading font-display font-semibold text-ink">
          The reading surface
        </h1>
        <p className="mt-3 max-w-xl text-body leading-relaxed text-muted-foreground">
          An artifact rendered as a document. The table of contents doubles as a gap map, so an
          unsettled clause is visible before you read it.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface px-5 py-6 md:px-8 md:py-8">
        <ArtifactDocument markdown={FIXTURE} title="Atlas product requirements" />
      </div>

      <section className="mt-16 border-t border-line pt-8">
        <p className="text-caption text-dim">The project workspace</p>
        <h2 className="mt-2 text-title font-medium text-ink">One map, one instruction, one ledger</h2>
        <div className="mt-8 rounded-lg border border-line bg-surface px-5 py-7 md:px-8 md:py-9">
          <h3 className="font-display text-heading font-semibold text-ink">Atlas</h3>
          <p className="mt-2 text-label text-dim">Full mode</p>
          <StageStepper
            className="mt-9"
            projectId="preview-atlas"
            currentPhase="domainModel"
            phases={WORKSPACE_PHASES}
            quality={WORKSPACE_QUALITY}
          />
          <NextActionPanel
            className="mt-8"
            projectId="preview-atlas"
            action={{ kind: "review", stageId: "requirements" }}
            quality={WORKSPACE_QUALITY}
          />
          <PhaseLedger
            className="mt-8"
            projectId="preview-atlas"
            phases={WORKSPACE_PHASES}
            currentPhase="domainModel"
          />
        </div>
      </section>

      <section data-preview="changes" className="mt-16 border-t border-line pt-8">
        <p className="text-caption text-dim">Changes</p>
        <h2 className="mt-2 text-title font-medium text-ink">A change as edits to the requirements</h2>
        <div className="mt-8">
          <ChangePreviews />
        </div>
      </section>

      <section data-preview="checks" className="mt-16 border-t border-line pt-8">
        <p className="text-caption text-dim">Pull-request checks</p>
        <h2 className="mt-2 text-title font-medium text-ink">A pull request against the requirements it touches</h2>
        <div className="mt-8">
          <CheckPreviews />
        </div>
      </section>

      <section data-preview="questions" className="mt-16 border-t border-line pt-8">
        <p className="text-caption text-dim">Questions &amp; Clarifications</p>
        <h2 className="mt-2 text-title font-medium text-ink">What each question feeds, and what is assumed</h2>
        <div className="mt-8 max-w-3xl">
          <QuestionPreviews />
        </div>
      </section>

      <section data-preview="phase-page" className="mt-16 border-t border-line pt-8">
        <p className="text-caption text-dim">A phase page</p>
        <h2 className="mt-2 text-title font-medium text-ink">Every phase beside the page</h2>
        <div className="mt-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-12">
          <ProjectNav
            projectId="preview-atlas"
            title="Atlas"
            modeLabel="Full"
            phases={WORKSPACE_PHASES}
            skippedPhases={["artifacts"]}
            currentPhase="prd"
          />
          <div className="min-w-0 pt-6 lg:pt-0">
            <p className="text-label text-dim">Requirements</p>
            <h3 className="mt-2 font-display text-heading font-semibold text-ink">PRD</h3>
            <p className="mt-3 max-w-xl text-body text-muted-foreground">
              Evidence-backed requirements with stable claim IDs
            </p>
          </div>
        </div>
      </section>

      <section className="mt-16 border-t border-line pt-8">
        <p className="text-caption text-dim">Projects</p>
        <h2 className="mt-2 text-title font-medium text-ink">How far each spec has come</h2>
        <div className="mt-8 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {PREVIEW_PROJECTS.map(({ project, phases, completed, pinned }) => (
            <ProjectCard
              key={project._id}
              project={project}
              phases={phases}
              isPinned={pinned}
              metrics={{
                completionPercentage: Math.round((completed / 8) * 100),
                completedPhases: completed,
                totalPhases: 8,
                healthScore: 100,
                stalenessFlags: [],
                verificationStatus: completed === 8 ? "passed" : "not_checked",
              }}
            />
          ))}
        </div>
      </section>

      <section className="mt-16 border-t border-line pt-8">
        <p className="text-caption text-dim">Second example, a measured stage</p>
        <h2 className="mt-2 text-title font-medium text-ink">The report and the section marks</h2>
        <p className="mt-3 max-w-xl text-body leading-relaxed text-muted-foreground">
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
