import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import ProjectPage from "../page";

const PROJECT = {
  _id: "p1",
  title: "Ledger",
  description: "A shared ledger for small teams.",
  mode: "full",
  skippedPhases: [],
  createdAt: 0,
};

let phases: Array<{ phaseId: string; status: string }> = [];

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("convex/react", () => ({
  useConvex: () => ({}),
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  useQuery: (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name === "projects:getProject") return PROJECT;
    if (name === "projects:getProjectPhases") return phases;
    return undefined;
  },
}));

vi.mock("@/components/codebase-connector", () => ({
  CodebaseConnector: ({ projectId }: { projectId: string }) => (
    <section aria-label="Repository">{projectId}</section>
  ),
}));

vi.mock("@/components/project-rules-card", () => ({
  ProjectRulesCard: () => null,
}));

describe("ProjectPage", () => {
  it("sends Generate all phases through the answers page", () => {
    phases = [{ phaseId: "brief", status: "pending" }];
    render(<ProjectPage />);

    expect(screen.getByRole("link", { name: "Generate all phases" })).toHaveAttribute(
      "href",
      "/project/p1/questions"
    );
  });

  it("hides Generate all phases when nothing is left to generate", () => {
    phases = [
      "constitution",
      "brief",
      "prd",
      "domainModel",
      "specs",
      "artifacts",
      "stories",
      "handoff",
    ].map((phaseId) => ({ phaseId, status: "ready" }));
    render(<ProjectPage />);

    expect(screen.queryByRole("link", { name: "Generate all phases" })).not.toBeInTheDocument();
  });

  it("connects a repository from the project page", () => {
    phases = [];
    render(<ProjectPage />);

    expect(screen.getByRole("region", { name: "Repository" })).toHaveTextContent("p1");
  });
});
