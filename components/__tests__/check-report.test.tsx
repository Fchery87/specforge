import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckReport, type ReportCheck, type ReportRequirement } from "@/components/checks/check-report";

const source = {
  kind: "pull_request" as const,
  number: 12,
  title: "Longer invitations",
  url: "https://github.com/Fchery87/ledger/pull/12",
  baseSha: "base1",
  headSha: "head1",
};

const check: ReportCheck = {
  checkedAt: Date.UTC(2026, 8, 28, 12),
  status: "fail",
  source,
  findings: [],
  verdicts: [
    {
      claimId: "REQ-0003",
      scope: "cited",
      verdict: "violated",
      severity: "critical",
      explanation: "The lifetime is thirty days, not fourteen.",
      evidence: [{ path: "convex/invitations.ts", line: 3, quote: "const INVITATION_LIFETIME_DAYS = 30;" }],
    },
    {
      claimId: "REQ-0004",
      scope: "inferred",
      verdict: "violated",
      severity: "major",
      explanation: "Anyone holding the link may accept.",
      evidence: [{ path: "convex/invitations.ts", line: 11, quote: "return now < expiresAt(invitation.issuedAt);" }],
    },
    { claimId: "REQ-0009", scope: "change", verdict: "met", severity: null, explanation: "Entries stay append-only.", evidence: [] },
  ],
  coverage: { reviewedFiles: ["convex/invitations.ts"], skippedFiles: [{ path: "package-lock.json", reason: "Lockfile" }] },
  otherFindings: [{ category: "security", title: "Token logged", description: "The invite token is written to the log.", path: "convex/invitations.ts" }],
  notes: ["CHG-0003 is cited but is still a draft, so its requirements were not checked."],
};

const requirements: Record<string, ReportRequirement> = {
  "REQ-0003": { text: "An invitation expires fourteen days after it is issued.", phaseId: "prd", decisionStatus: "confirmed", reviewStatus: "current", retired: false },
  "REQ-0004": { text: "Only the addressee may accept an invitation.", phaseId: "prd", decisionStatus: "proposed", reviewStatus: "needs_review", retired: false },
};

function renderReport(overrides: Partial<ReportCheck> = {}, repositoryUrl: string | null = "https://github.com/Fchery87/ledger") {
  return render(<CheckReport projectId="p1" check={{ ...check, ...overrides }} requirements={requirements} repositoryUrl={repositoryUrl} />);
}

describe("CheckReport", () => {
  it("states the outcome, what was checked and how much was read", () => {
    renderReport();

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("1 critical, 1 major")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#12 Longer invitations" })).toHaveAttribute("href", "https://github.com/Fchery87/ledger/pull/12");
    expect(screen.getByText(/Read 1 file, skipped 1\./)).toBeInTheDocument();
  });

  it("shows each verdict with the requirement's wording and links each quote to the checked commit", () => {
    renderReport();
    const items = within(screen.getByRole("region", { name: "Requirements" })).getAllByRole("listitem").filter((item) => item.parentElement?.getAttribute("aria-label") === null);

    expect(items[0]).toHaveTextContent("REQ-0003");
    expect(items[0]).toHaveTextContent("Violated, critical");
    expect(items[0]).toHaveTextContent("Cited in the pull request");
    expect(items[0]).toHaveTextContent("An invitation expires fourteen days after it is issued.");
    expect(within(items[0]).getByRole("link", { name: "convex/invitations.ts:3" })).toHaveAttribute(
      "href",
      "https://github.com/Fchery87/ledger/blob/head1/convex/invitations.ts#L3",
    );
    expect(screen.getByText("const INVITATION_LIFETIME_DAYS = 30;")).toBeInTheDocument();
    expect(screen.getByText("Picked by the check")).toBeInTheDocument();
    expect(screen.getByText("This requirement is no longer in the project.")).toBeInTheDocument();
  });

  it("tells the reader how to make a violation of an unconfirmed requirement critical", () => {
    renderReport();

    expect(screen.getByText(/REQ-0004 is still proposed, so this is graded major\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Confirm it on the PRD page" })).toHaveAttribute("href", "/project/p1/phase/prd");
    expect(screen.queryByText(/REQ-0003 is still/)).not.toBeInTheDocument();
  });

  it("lists the files it did not read, the other problems and the notes", () => {
    renderReport();

    expect(within(screen.getByRole("region", { name: "Not read" })).getByText("package-lock.json")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Other problems" })).getByText("Token logged")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Notes" })).getByText(/CHG-0003 is cited but is still a draft/)).toBeInTheDocument();
  });

  it("says when the check is outdated, and shows a pasted diff's quotes without links", () => {
    renderReport({ outdatedAt: 1, source: { kind: "pasted" } });

    expect(screen.getByRole("status")).toHaveTextContent("Requirements or documents changed after this check.");
    expect(screen.queryByRole("link", { name: /convex\/invitations\.ts/ })).not.toBeInTheDocument();
    expect(screen.getByText("convex/invitations.ts:3")).toBeInTheDocument();
  });

  it("shows a check made before phase 8 as its findings", () => {
    renderReport({
      verdicts: undefined,
      coverage: undefined,
      otherFindings: undefined,
      notes: undefined,
      source: undefined,
      phaseId: "specs",
      status: "warning",
      findings: [{ severity: "major", title: "Missing validation", description: "The email is not checked.", suggestion: "Validate it." }],
    });

    expect(screen.getByText(/Pasted diff, Architecture, checked/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Findings" })).getByText("Missing validation")).toBeInTheDocument();
    expect(screen.getByText("1 major")).toBeInTheDocument();
  });
});
