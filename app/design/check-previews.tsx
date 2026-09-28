"use client";

import { CheckList } from "@/components/checks/check-list";
import { CheckReport, type ReportCheck } from "@/components/checks/check-report";
import { CheckSourceForm } from "@/components/checks/check-source-form";

const PREVIEW_CHECK: ReportCheck = {
  checkedAt: Date.UTC(2026, 8, 28, 14, 5),
  status: "fail",
  source: {
    kind: "pull_request",
    number: 58,
    title: "Invite members with a link",
    url: "https://github.com/atlas/atlas/pull/58",
    baseSha: "4f2a91c",
    headSha: "9b7e3d0",
  },
  findings: [],
  verdicts: [
    {
      claimId: "REQ-0012",
      scope: "cited",
      verdict: "violated",
      severity: "critical",
      explanation: "Accepting no longer compares the email on the invitation with the person accepting it.",
      evidence: [{ path: "convex/invitations.ts", line: 41, quote: "return now < expiresAt(invitation.issuedAt);" }],
    },
    {
      claimId: "REQ-0020",
      scope: "change",
      verdict: "incomplete",
      severity: "minor",
      explanation: "Links expire after seven days, but an expired link still opens the invite page instead of saying it has expired.",
      evidence: [{ path: "app/invite/[token]/page.tsx", line: 18, quote: "if (!invitation) notFound();" }],
    },
    {
      claimId: "REQ-0021",
      scope: "inferred",
      verdict: "met",
      severity: null,
      explanation: "Opening a link routes to the invite page for that team.",
      evidence: [{ path: "app/invite/[token]/page.tsx", line: 12, quote: "const invitation = await getInvitation(params.token);" }],
    },
  ],
  coverage: {
    reviewedFiles: ["convex/invitations.ts", "app/invite/[token]/page.tsx"],
    skippedFiles: [{ path: "package-lock.json", reason: "Lockfile" }],
  },
  otherFindings: [
    { category: "security", title: "Invite token in the log", description: "The token is logged in full on every lookup.", path: "convex/invitations.ts" },
  ],
  notes: ["CHG-0003 is cited but is still a draft, so its requirements were not checked."],
};

const PREVIEW_REQUIREMENTS = {
  "REQ-0012": { text: "Only the person at the addressed email may accept an invitation.", phaseId: "prd", decisionStatus: "confirmed", reviewStatus: "current" as const, retired: false },
  "REQ-0020": { text: "An invite link expires seven days after it is created.", phaseId: "prd", decisionStatus: "proposed", reviewStatus: "needs_review" as const, retired: false },
  "REQ-0021": { text: "Opening an invite link shows that team's invite page.", phaseId: "stories", decisionStatus: "confirmed", reviewStatus: "current" as const, retired: false },
};

const noop = async () => {};

/** Fixtures for the pull-request check surfaces, which read Convex and GitHub in the product. */
export function CheckPreviews() {
  return (
    <div className="grid gap-10 *:min-w-0">
      <div className="rounded-lg border border-line bg-surface px-5 py-6 md:px-8">
        <h3 className="font-display text-title font-semibold text-ink">Pull-request checks</h3>
        <div className="mt-5">
          <CheckList
            projectId="preview-atlas"
            checks={[
              {
                _id: "vr3",
                checkedAt: Date.UTC(2026, 8, 28),
                status: "fail",
                source: PREVIEW_CHECK.source,
                counts: { critical: 1, major: 0, minor: 1 },
              },
              {
                _id: "vr2",
                checkedAt: Date.UTC(2026, 8, 27),
                status: "warning",
                outdatedAt: 1,
                source: { kind: "range", base: "main", head: "feature/archive", baseSha: "a", headSha: "b" },
                counts: { critical: 0, major: 1, minor: 0 },
              },
              { _id: "vr1", checkedAt: Date.UTC(2026, 8, 20), status: "pass", source: { kind: "pasted" }, counts: { critical: 0, major: 0, minor: 0 } },
            ]}
          />
        </div>
      </div>

      <div data-preview="check-source" className="max-w-xl rounded-lg border border-line bg-panel p-6">
        <CheckSourceForm
          picker={{
            status: "ready",
            repository: "atlas/atlas",
            pullRequests: [
              { number: 58, title: "Invite members with a link", state: "open", author: "mara" },
              { number: 57, title: "Archive a project", state: "merged", author: "dev" },
              { number: 55, title: "Fix the invite page 404", state: "merged", author: "mara" },
            ],
          }}
          onSubmit={noop}
          onCancel={() => {}}
        />
      </div>

      <div data-preview="check-report">
        <CheckReport projectId="preview-atlas" check={PREVIEW_CHECK} requirements={PREVIEW_REQUIREMENTS} repositoryUrl="https://github.com/atlas/atlas" />
      </div>
    </div>
  );
}
