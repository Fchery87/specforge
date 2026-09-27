import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhaseLedger } from "../phase-ledger";

describe("PhaseLedger", () => {
  const phases = {
    constitution: "ready",
    brief: "ready",
    prd: "error",
    domainModel: "generating",
    specs: "pending",
  } as const;

  it("lists all eight phases in workflow order with their stage", () => {
    render(<PhaseLedger projectId="p1" phases={phases} />);
    const rows = screen.getAllByRole("row").slice(1);

    expect(rows.map((row) => within(row).getAllByRole("cell")[1].textContent)).toEqual([
      "Project Rules",
      "Brief",
      "PRD",
      "Domain Model",
      "Architecture",
      "Schemas",
      "Tasks",
      "Export",
    ]);
    expect(within(rows[0]).getByText("Rules")).toBeInTheDocument();
    expect(within(rows[4]).getByText("Design")).toBeInTheDocument();
  });

  it("links each phase to its page", () => {
    render(<PhaseLedger projectId="p1" phases={phases} />);

    expect(screen.getByRole("link", { name: "PRD" })).toHaveAttribute("href", "/project/p1/phase/prd");
  });

  it("states each status as a word", () => {
    render(<PhaseLedger projectId="p1" phases={phases} skippedPhases={["artifacts"]} />);

    expect(screen.getByRole("row", { name: /PRD.*Error/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Domain Model.*Generating/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Architecture.*Not started/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Schemas.*Skipped/ })).toBeInTheDocument();
  });

  it("marks the current phase for assistive tech and for the eye", () => {
    render(<PhaseLedger projectId="p1" phases={phases} currentPhase="domainModel" />);
    const current = screen.getByRole("row", { name: /Domain Model/ });

    expect(current).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("row", { name: /Brief/ })).not.toHaveAttribute("aria-current");
  });
});
