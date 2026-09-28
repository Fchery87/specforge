import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import CheckPage from "../page";

let project: Record<string, unknown> | null;
let data: Record<string, unknown> | undefined;

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1", checkId: "vr1" }),
  usePathname: () => "/project/p1/check/vr1",
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name === "projects:getProject") return project;
    if (name === "projects:getProjectPhases") return [{ phaseId: "prd", status: "ready" }];
    if (name === "verification:getCheck") return data;
    return undefined;
  },
}));

const check = {
  _id: "vr1",
  projectId: "p1",
  checkedAt: 1,
  status: "warning",
  overallScore: 90,
  findings: [],
  source: { kind: "pull_request", number: 12, title: "Longer invitations", url: "https://github.com/o/r/pull/12", baseSha: "b", headSha: "h" },
  verdicts: [{ claimId: "REQ-0004", scope: "cited", verdict: "violated", severity: "major", explanation: "Thirty days.", evidence: [] }],
  coverage: { reviewedFiles: ["a.ts"], skippedFiles: [] },
};

describe("CheckPage", () => {
  beforeEach(() => {
    project = { _id: "p1", title: "Ledger", mode: "full", skippedPhases: [] };
    data = {
      check,
      requirements: { "REQ-0004": { text: "Invitations expire after fourteen days.", phaseId: "prd", decisionStatus: "proposed", reviewStatus: "needs_review", retired: false } },
      repositoryUrl: "https://github.com/o/r",
    };
  });

  it("names what was checked and shows its report beside the project sidebar", () => {
    render(<CheckPage />);

    expect(screen.getByRole("heading", { level: 1, name: "#12 Longer invitations" })).toBeInTheDocument();
    expect(screen.getByText("Invitations expire after fourteen days.")).toBeInTheDocument();
    expect(screen.getAllByText("Ledger").length).toBeGreaterThan(0);
  });

  it("refuses a check from another project", () => {
    data = { ...data, check: { ...check, projectId: "p2" } };
    render(<CheckPage />);
    expect(screen.getByRole("heading", { level: 1, name: "This check belongs to another project" })).toBeInTheDocument();
  });

  it("says when the project is gone", () => {
    project = null;
    render(<CheckPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Project not found" })).toBeInTheDocument();
  });
});
