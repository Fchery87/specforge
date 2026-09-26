import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StagePhaseLinks } from "../stage-phase-links";

describe("StagePhaseLinks", () => {
  it("links every phase of the current stage, so a generated document stays openable", () => {
    // The regression this exists for: the stepper links once per stage to a single target phase, so
    // once the Design phases were all ready only domainModel was reachable.
    render(<StagePhaseLinks projectId="p1" currentPhase="specs" />);

    expect(screen.getByRole("link", { name: "Domain Model" })).toHaveAttribute(
      "href",
      "/project/p1/phase/domainModel"
    );
    expect(screen.getByRole("link", { name: "Architecture" })).toHaveAttribute(
      "href",
      "/project/p1/phase/specs"
    );
    expect(screen.getByRole("link", { name: "Schemas" })).toHaveAttribute(
      "href",
      "/project/p1/phase/artifacts"
    );
  });

  it("marks the phase being read and no other", () => {
    render(<StagePhaseLinks projectId="p1" currentPhase="prd" />);

    expect(screen.getByRole("link", { name: "PRD" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Brief" })).not.toHaveAttribute("aria-current");
  });

  it("omits a skipped phase, which is re-enabled from AddSectionMenu", () => {
    render(
      <StagePhaseLinks projectId="p1" currentPhase="specs" skippedPhases={["artifacts"]} />
    );

    expect(screen.queryByRole("link", { name: "Schemas" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Architecture" })).toBeInTheDocument();
  });

  it("renders nothing for a phase outside every stage", () => {
    const { container: constitution } = render(
      <StagePhaseLinks projectId="p1" currentPhase="constitution" />
    );
    expect(constitution.firstChild).toBeNull();

    const { container: handoff } = render(
      <StagePhaseLinks projectId="p1" currentPhase="handoff" />
    );
    expect(handoff.firstChild).toBeNull();
  });

  it("renders nothing when the stage has only one visible phase", () => {
    // Tasks holds one phase, so a row of one link is noise.
    const { container } = render(<StagePhaseLinks projectId="p1" currentPhase="stories" />);
    expect(container.firstChild).toBeNull();
  });

  it("names the navigation for a screen reader", () => {
    render(<StagePhaseLinks projectId="p1" currentPhase="prd" />);
    expect(screen.getByRole("navigation", { name: "Requirements sections" })).toBeInTheDocument();
  });
});
