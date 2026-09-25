import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageCard } from "../stage-card";
import { WORKFLOW_STAGES, type PhaseStatusMap } from "@/lib/workflow";

describe("StageCard", () => {
  const requirementsStage = WORKFLOW_STAGES.find((s) => s.id === "requirements")!;
  const designStage = WORKFLOW_STAGES.find((s) => s.id === "design")!;

  it("asserts the status text and the button label for a ready stage", () => {
    const readyPhases: PhaseStatusMap = {
      brief: "ready",
      prd: "ready",
    };

    render(
      <StageCard
        projectId="proj-123"
        stage={requirementsStage}
        phases={readyPhases}
      />
    );

    // Asserts stage summary
    expect(screen.getByText(requirementsStage.summary)).toBeInTheDocument();

    // Asserts status text "Ready"
    expect(screen.getByText("Ready")).toBeInTheDocument();

    // Asserts button label for a ready stage
    const button = screen.getByRole("link", { name: /review requirements/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("href", "/project/proj-123/phase/brief");
  });

  it("asserts the status text and the button label for a stage that is not started", () => {
    const notStartedPhases: PhaseStatusMap = {
      brief: { status: "pending" },
      prd: { status: "pending" },
    };

    render(
      <StageCard
        projectId="proj-123"
        stage={requirementsStage}
        phases={notStartedPhases}
      />
    );

    // Asserts stage summary
    expect(screen.getByText(requirementsStage.summary)).toBeInTheDocument();

    // Asserts status text "Not started"
    expect(screen.getByText("Not started")).toBeInTheDocument();

    // Asserts button label for a stage that is not started
    const button = screen.getByRole("link", { name: /answer questions/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("href", "/project/proj-123/phase/brief");
  });

  it("renders 'Continue to Design' when previous stage is ready and current stage is not started", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "ready",
      domainModel: "pending",
      specs: "pending",
      artifacts: "pending",
      stories: "pending",
    };

    render(
      <StageCard
        projectId="proj-123"
        stage={designStage}
        phases={phases}
      />
    );

    expect(screen.getByText("Not started")).toBeInTheDocument();
    const button = screen.getByRole("link", { name: /continue to design/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("href", "/project/proj-123/phase/domainModel");
  });

  it("respects explicitly passed action prop", () => {
    render(
      <StageCard
        projectId="proj-123"
        stage={requirementsStage}
        phases={{ brief: "ready", prd: "ready" }}
        action={{ kind: "generate", phaseId: "brief" }}
      />
    );

    const button = screen.getByRole("link", { name: /generate/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("href", "/project/proj-123/phase/brief");
  });
});
