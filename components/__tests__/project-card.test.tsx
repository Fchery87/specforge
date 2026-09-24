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

  it("renders pipeline progress and phase segments when metrics provided", () => {
    const mockMetrics = {
      completionPercentage: 57,
      completedPhases: 4,
      totalPhases: 7,
      healthScore: 98,
      stalenessFlags: [],
      verificationStatus: "passed" as const,
    };

    render(<ProjectCard project={mockProject} metrics={mockMetrics} />);

    expect(screen.getByText("Pipeline Progress")).toBeInTheDocument();
    expect(screen.getByText("4/7 (57%)")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
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
});
