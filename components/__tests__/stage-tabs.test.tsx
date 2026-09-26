import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StageTabs } from "../stage-tabs";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

describe("StageTabs", () => {
  it("renders enabled phases with correct label mapping", () => {
    render(
      <StageTabs
        projectId="p1"
        currentPhase="prd"
        phases={{ brief: "ready", prd: "pending" }}
        skippedPhases={[]}
      />
    );

    const briefTab = screen.getByRole("link", { name: "Brief" });
    const prdTab = screen.getByRole("link", { name: "PRD" });

    expect(briefTab).toBeInTheDocument();
    expect(briefTab).toHaveAttribute("href", "/project/p1/phase/brief");
    expect(briefTab).not.toHaveAttribute("aria-current", "page");

    expect(prdTab).toBeInTheDocument();
    expect(prdTab).toHaveAttribute("href", "/project/p1/phase/prd");
    expect(prdTab).toHaveAttribute("aria-current", "page");

    expect(screen.queryByText(/add a section/i)).not.toBeInTheDocument();
  });

  it("renders mapped labels for Design stage: Domain Model, Architecture, Schemas", () => {
    render(
      <StageTabs
        projectId="p1"
        currentPhase="specs"
        phases={{ domainModel: "ready", specs: "pending", artifacts: "pending" }}
        skippedPhases={[]}
      />
    );

    expect(screen.getByRole("link", { name: "Domain Model" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Architecture" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Schemas" })).toBeInTheDocument();
  });

  it("renders mapped label for Tasks stage: Tasks", () => {
    render(
      <StageTabs
        projectId="p1"
        currentPhase="stories"
        phases={{ stories: "pending" }}
        skippedPhases={[]}
      />
    );

    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
  });

  it("renders only enabled phases and shows 'Add a section' when phases in current stage are skipped", () => {
    const handleToggleSkip = vi.fn();

    render(
      <StageTabs
        projectId="p1"
        currentPhase="specs"
        phases={{ domainModel: "skipped", specs: "pending", artifacts: "skipped" }}
        skippedPhases={["domainModel", "artifacts"]}
        onToggleSkip={handleToggleSkip}
      />
    );

    // Only Architecture tab is rendered
    expect(screen.getByRole("link", { name: "Architecture" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Domain Model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Schemas" })).not.toBeInTheDocument();

    // "Add a section" button is rendered
    const addSectionBtn = screen.getByRole("button", { name: /add a section/i });
    expect(addSectionBtn).toBeInTheDocument();

    const domainModelOption = screen.getByText("Domain Model");
    expect(domainModelOption).toBeInTheDocument();
    const schemasOption = screen.getByText("Schemas");
    expect(schemasOption).toBeInTheDocument();

    fireEvent.click(domainModelOption);
    expect(handleToggleSkip).toHaveBeenCalledWith("domainModel");
  });

  it("returns null if currentPhase does not belong to any workflow stage (e.g. constitution)", () => {
    const { container } = render(
      <StageTabs
        projectId="p1"
        currentPhase="constitution"
        phases={{ constitution: "ready" }}
        skippedPhases={[]}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
