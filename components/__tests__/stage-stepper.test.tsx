import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageStepper } from "../stage-stepper";
import type { PhaseStatusMap } from "@/lib/workflow";

describe("StageStepper", () => {
  it("renders exactly three links with labels 'Requirements', 'Design', and 'Tasks', and asserts no element with text 'Skipped' is present", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "pending",
      domainModel: "skipped",
      specs: "pending",
      artifacts: "skipped",
      stories: "pending",
    };

    render(
      <StageStepper
        projectId="project-123"
        currentPhase="prd"
        phases={phases}
        skippedPhases={["domainModel", "artifacts"]}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);

    expect(screen.getByRole("link", { name: /requirements/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /design/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();

    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument();
  });

  it("links each step to the first enabled phase in the stage that is not ready", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "pending",
      domainModel: "skipped",
      specs: "ready",
      artifacts: "pending",
      stories: "pending",
    };

    render(
      <StageStepper
        projectId="proj-456"
        currentPhase="brief"
        phases={phases}
        skippedPhases={["domainModel"]}
      />
    );

    const requirementsLink = screen.getByRole("link", { name: /requirements/i });
    expect(requirementsLink).toHaveAttribute("href", "/project/proj-456/phase/prd");

    const designLink = screen.getByRole("link", { name: /design/i });
    expect(designLink).toHaveAttribute("href", "/project/proj-456/phase/artifacts");

    const tasksLink = screen.getByRole("link", { name: /tasks/i });
    expect(tasksLink).toHaveAttribute("href", "/project/proj-456/phase/stories");
  });

  it("links to the first enabled phase when all enabled phases in the stage are ready", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "ready",
      domainModel: "skipped",
      specs: "ready",
      artifacts: "ready",
      stories: "ready",
    };

    render(
      <StageStepper
        projectId="proj-789"
        currentPhase="stories"
        phases={phases}
        skippedPhases={["domainModel"]}
      />
    );

    const requirementsLink = screen.getByRole("link", { name: /requirements/i });
    expect(requirementsLink).toHaveAttribute("href", "/project/proj-789/phase/brief");

    const designLink = screen.getByRole("link", { name: /design/i });
    expect(designLink).toHaveAttribute("href", "/project/proj-789/phase/specs");
  });

  it("highlights the step if currentPhase belongs to the stage", () => {
    render(
      <StageStepper
        projectId="proj-1"
        currentPhase="specs"
        phases={{}}
        skippedPhases={[]}
      />
    );

    const requirementsLink = screen.getByRole("link", { name: /requirements/i });
    const designLink = screen.getByRole("link", { name: /design/i });
    const tasksLink = screen.getByRole("link", { name: /tasks/i });

    expect(requirementsLink).not.toHaveAttribute("aria-current", "step");
    expect(designLink).toHaveAttribute("aria-current", "step");
    expect(tasksLink).not.toHaveAttribute("aria-current", "step");
  });

  it("does not highlight any step if currentPhase === 'constitution'", () => {
    render(
      <StageStepper
        projectId="proj-1"
        currentPhase="constitution"
        phases={{}}
        skippedPhases={[]}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).not.toHaveAttribute("aria-current", "step");
    }
  });

  it("displays stage status labels correctly", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "ready",
      specs: "generating",
      stories: "pending",
    };

    render(
      <StageStepper
        projectId="proj-1"
        currentPhase="specs"
        phases={phases}
        skippedPhases={["domainModel", "artifacts"]}
      />
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Generating")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });
});
