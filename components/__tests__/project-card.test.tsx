import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ProjectCard } from "../dashboard/project-card";
import type { Id } from "@/convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue({}),
  useQuery: () => null,
}));

describe("ProjectCard component", () => {
  const mockProject = {
    _id: "test-proj-123" as Id<"projects">,
    title: "AI Specification Generator",
    description: "Generates high quality specifications from natural language requirements.",
    status: "active" as const,
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 2,
  };

  it("renders project title, description, and status", () => {
    render(<ProjectCard project={mockProject} />);

    expect(screen.getByText("AI Specification Generator")).toBeInTheDocument();
    expect(
      screen.getByText("Generates high quality specifications from natural language requirements.")
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("states progress as phases ready, beside the stage band", () => {
    const mockMetrics = {
      completionPercentage: 57,
      completedPhases: 4,
      totalPhases: 7,
      healthScore: 98,
      stalenessFlags: [],
      verificationStatus: "passed" as const,
    };

    const { container } = render(
      <ProjectCard
        project={mockProject}
        metrics={mockMetrics}
        phases={[
          { phaseId: "brief", status: "ready" as const },
          { phaseId: "prd", status: "pending" as const },
        ]}
      />
    );

    expect(screen.getByText("4 of 7 phases ready")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    // The band draws one segment per phase in the three stages: 2 + 3 + 1.
    expect(container.querySelectorAll("[data-band] [data-phase]")).toHaveLength(6);
    expect(container.querySelector('[data-phase="prd"]')).toHaveAttribute("data-state", "now");
  });

  it("keeps the options menu outside the row's link", () => {
    render(<ProjectCard project={mockProject} onDelete={() => {}} />);
    const options = screen.getByRole("button", { name: /project options/i });

    expect(options.closest("a")).toBeNull();
  });

  it("calls onDelete callback when Delete menu option is clicked", async () => {
    const onDelete = vi.fn();
    render(<ProjectCard project={mockProject} onDelete={onDelete} />);

    const menuTrigger = screen.getByRole("button", { name: /project options/i });
    fireEvent.pointerDown(menuTrigger);

    const deleteItem = await screen.findByText("Delete");
    fireEvent.click(deleteItem);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders mode badge when mode is provided", () => {
    render(<ProjectCard project={{ ...mockProject, mode: "quick" }} />);
    expect(screen.getByText("Quick Spec")).toBeInTheDocument();

    render(<ProjectCard project={{ ...mockProject, mode: "backend" }} />);
    expect(screen.getByText("API & Backend")).toBeInTheDocument();
  });

  it("asserts 'Resume at Design' and the Design href for a project whose Requirements stage is ready", () => {
    const mockPhases = [
      { phaseId: "brief", status: "ready" as const },
      { phaseId: "prd", status: "ready" as const },
      { phaseId: "domainModel", status: "pending" as const },
      { phaseId: "specs", status: "pending" as const },
      { phaseId: "artifacts", status: "pending" as const },
      { phaseId: "stories", status: "pending" as const },
    ];

    render(<ProjectCard project={mockProject} phases={mockPhases} />);

    expect(screen.getByText("Resume at Design")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /resume at design/i });
    expect(link).toHaveAttribute("href", "/project/test-proj-123/phase/domainModel");
  });

  it("asserts 'Export' and the Export href when all phases are ready", () => {
    const allReadyPhases = [
      { phaseId: "brief", status: "ready" as const },
      { phaseId: "prd", status: "ready" as const },
      { phaseId: "domainModel", status: "ready" as const },
      { phaseId: "specs", status: "ready" as const },
      { phaseId: "artifacts", status: "ready" as const },
      { phaseId: "stories", status: "ready" as const },
    ];

    render(<ProjectCard project={mockProject} phases={allReadyPhases} />);

    expect(screen.getByText("Export")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /export/i });
    expect(link).toHaveAttribute("href", "/project/test-proj-123/phase/handoff");
  });
});
