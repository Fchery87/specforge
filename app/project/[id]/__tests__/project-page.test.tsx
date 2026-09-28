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
let artifacts: Array<{ type: string; content: string }> = [];
let readiness: { ready: boolean } | undefined;

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
  useRouter: () => ({ push: vi.fn() }),
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
    if (name === "artifacts:getAllProjectArtifacts") return artifacts;
    if (name === "userConfigs:getGenerationReadiness") return readiness;
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

  it("links saved quick specs only when the project has one", () => {
    phases = [];
    artifacts = [];
    const { unmount } = render(<ProjectPage />);
    expect(screen.queryByRole("link", { name: "Saved quick specs" })).not.toBeInTheDocument();
    unmount();

    artifacts = [{ type: "quickSpec", content: "# Spec" }];
    render(<ProjectPage />);
    expect(screen.getByRole("link", { name: "Saved quick specs" })).toHaveAttribute("href", "/project/p1/quick");
  });

  it("warns before generation when no model is connected", () => {
    phases = [];
    readiness = { ready: false };
    render(<ProjectPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Connect a model to generate specs");
    expect(screen.getByRole("link", { name: "Open Settings" })).toHaveAttribute("href", "/settings");
    readiness = undefined;
  });
});
