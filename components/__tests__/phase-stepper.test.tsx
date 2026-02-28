import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PhaseStepper } from "../phase-stepper";

describe("PhaseStepper", () => {
  it("replaces the number with status icons for non-pending phases", () => {
    // PHASES: constitution(1), brief(2), prd(3), domainModel(4), specs(5), stories(6), artifacts(7), handoff(8)
    render(
      <PhaseStepper
        {...({
          projectId: "p1",
          currentPhase: "brief",
          phaseStatuses: { brief: "ready", prd: "pending", specs: "error" },
        } as any)}
      />
    );

    // "brief" (badge 2) has status "ready" → icon replaces number
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    // "specs" (badge 5) has status "error" → icon replaces number
    expect(screen.queryByText("5")).not.toBeInTheDocument();
    // "prd" (badge 3) has status "pending" → renders number
    expect(screen.getByText("3")).toBeInTheDocument();
    // "constitution" (badge 1) has no status → defaults to pending → renders number
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

