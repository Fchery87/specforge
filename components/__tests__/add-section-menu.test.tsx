import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddSectionMenu } from "../add-section-menu";

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

describe("AddSectionMenu", () => {
  it("renders nothing when no phase is skipped", () => {
    const { container } = render(<AddSectionMenu skippedPhases={[]} onEnable={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("lists the skipped phases with their workflow labels", () => {
    render(<AddSectionMenu skippedPhases={["domainModel", "artifacts"]} onEnable={() => {}} />);

    expect(screen.getByRole("button", { name: /add a section/i })).toBeInTheDocument();
    expect(screen.getByText("Domain Model")).toBeInTheDocument();
    expect(screen.getByText("Schemas")).toBeInTheDocument();
  });

  it("reports the phase to enable when an item is chosen", () => {
    const handleEnable = vi.fn();
    render(<AddSectionMenu skippedPhases={["domainModel"]} onEnable={handleEnable} />);

    fireEvent.click(screen.getByText("Domain Model"));
    expect(handleEnable).toHaveBeenCalledWith("domainModel");
  });

  it("falls back to the raw phase id when it has no label", () => {
    render(<AddSectionMenu skippedPhases={["somethingNew"]} onEnable={() => {}} />);
    expect(screen.getByText("somethingNew")).toBeInTheDocument();
  });
});
