import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextActionButton } from "../next-action-button";

describe("NextActionButton", () => {
  it("renders 'Answer questions' with correct href for kind 'answer'", () => {
    render(
      <NextActionButton
        projectId="proj-123"
        action={{ kind: "answer", phaseId: "brief" }}
      />
    );

    const link = screen.getByRole("link", { name: /answer questions/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/project/proj-123/phase/brief");
  });

  it("renders 'Generate' with correct href for kind 'generate'", () => {
    render(
      <NextActionButton
        projectId="proj-123"
        action={{ kind: "generate", phaseId: "prd" }}
      />
    );

    const link = screen.getByRole("link", { name: /generate/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/project/proj-123/phase/prd");
  });

  it("renders 'Continue to Design' linking to domainModel when design is unskipped", () => {
    render(
      <NextActionButton
        projectId="proj-123"
        action={{ kind: "continue", stageId: "design" }}
        skippedPhases={[]}
      />
    );

    const link = screen.getByRole("link", { name: /continue to design/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/project/proj-123/phase/domainModel");
  });

  it("renders 'Continue to Design' linking to first enabled phase (specs) when domainModel is skipped", () => {
    render(
      <NextActionButton
        projectId="proj-123"
        action={{ kind: "continue", stageId: "design" }}
        skippedPhases={["domainModel"]}
      />
    );

    const link = screen.getByRole("link", { name: /continue to design/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/project/proj-123/phase/specs");
  });

  it("renders 'Continue to Design' respecting firstEnabledPhaseInDesign prop", () => {
    render(
      <NextActionButton
        projectId="proj-123"
        action={{ kind: "continue", stageId: "design" }}
        firstEnabledPhaseInDesign="specs"
      />
    );

    const link = screen.getByRole("link", { name: /continue to design/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/project/proj-123/phase/specs");
  });

  it("renders 'Continue to Tasks' linking to stories for kind 'continue' stageId 'tasks'", () => {
    render(
      <NextActionButton
        projectId="proj-123"
        action={{ kind: "continue", stageId: "tasks" }}
      />
    );

    const link = screen.getByRole("link", { name: /continue to tasks/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/project/proj-123/phase/stories");
  });

  it("renders 'Export' linking to handoff for kind 'export'", () => {
    render(
      <NextActionButton
        projectId="proj-123"
        action={{ kind: "export" }}
      />
    );

    const link = screen.getByRole("link", { name: /export/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/project/proj-123/phase/handoff");
  });
});
