import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FileText } from "lucide-react";
import { ProjectPhaseCard } from "../project-phase-card";

describe("ProjectPhaseCard", () => {
  it("shows a Ready badge when status is ready", () => {
    render(
      <ProjectPhaseCard
        projectId="p1"
        phaseId="brief"
        label="Brief"
        description="Define the project scope"
        icon={FileText}
        index={0}
        status="ready"
      />
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("hides the status badge when status is pending", () => {
    render(
      <ProjectPhaseCard
        projectId="p1"
        phaseId="brief"
        label="Brief"
        description="Define the project scope"
        icon={FileText}
        index={0}
        status="pending"
      />
    );

    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });
});
