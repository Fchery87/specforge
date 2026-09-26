import { notFound } from "next/navigation";
import { ArtifactDocument } from "@/components/artifact-document";

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
    </div>
  );
}
