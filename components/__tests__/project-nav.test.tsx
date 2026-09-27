import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectNav, outlinePosition } from "../project-nav";

const phases = [
  { phaseId: "constitution", status: "ready" },
  { phaseId: "brief", status: "ready" },
  { phaseId: "prd", status: "pending" },
  { phaseId: "domainModel", status: "error" },
] as const;

function renderNav(skippedPhases: string[] = []) {
  return render(
    <ProjectNav
      projectId="p1"
      title="Ledger"
      modeLabel="Full"
      phases={phases}
      skippedPhases={skippedPhases}
      currentPhase="prd"
    />
  );
}

describe("ProjectNav", () => {
  it("lists every phase in reading order, each linked to its page", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: "Project" });
    const links = within(nav).getAllByRole("link").slice(2);

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/project/p1/phase/constitution",
      "/project/p1/phase/brief",
      "/project/p1/phase/prd",
      "/project/p1/phase/domainModel",
      "/project/p1/phase/specs",
      "/project/p1/phase/artifacts",
      "/project/p1/phase/stories",
      "/project/p1/phase/handoff",
    ]);
  });

  it("names each phase's status and marks the current phase", () => {
    renderNav(["artifacts"]);
    const nav = screen.getByRole("navigation", { name: "Project" });

    expect(within(nav).getByRole("link", { name: "PRD, Not started" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Brief, Ready" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Domain Model, Error" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Schemas, Skipped" })).toBeInTheDocument();
  });

  it("links back to the project and to all projects", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: "Project" });

    expect(within(nav).getByRole("link", { name: "Ledger" })).toHaveAttribute("href", "/project/p1");
    expect(within(nav).getByRole("link", { name: "All projects" })).toHaveAttribute("href", "/dashboard");
    expect(within(nav).getByText("Full mode")).toBeInTheDocument();
  });

  it("folds into a button that names the place and opens the same list", () => {
    renderNav(["artifacts"]);

    fireEvent.click(screen.getByRole("button", { name: "Ledger, PRD, phase 3 of 7. Show all phases" }));

    const dialog = screen.getByRole("dialog", { name: "Project phases" });
    expect(within(dialog).getByRole("link", { name: "PRD, Not started" })).toHaveAttribute("aria-current", "page");
  });
});

describe("outlinePosition", () => {
  it("counts only phases the reader can open", () => {
    expect(outlinePosition(phases, [], "prd")).toEqual({ index: 3, total: 8 });
    expect(outlinePosition(phases, ["domainModel", "artifacts"], "stories")).toEqual({ index: 5, total: 6 });
  });

  it("counts a skipped phase the reader is on", () => {
    expect(outlinePosition(phases, ["artifacts"], "artifacts")).toEqual({ index: 6, total: 8 });
  });
});
