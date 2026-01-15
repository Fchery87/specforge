import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PhaseStepper } from "../phase-stepper";

describe("PhaseStepper", () => {
  it("replaces the number with status icons for non-pending phases", () => {
    render(
      <PhaseStepper
        {...({
          projectId: "p1",
          currentPhase: "brief",
          phaseStatuses: { brief: "ready", prd: "pending", specs: "error" },
        } as any)}
      />
    );

    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
