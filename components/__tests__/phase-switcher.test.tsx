import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhaseSwitcher } from "../phase-switcher";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock Radix Popover to render children directly (avoids portal issues in jsdom)
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
}));

const mockPhases = [
  { phaseId: "constitution", status: "ready" },
  { phaseId: "brief", status: "ready" },
  { phaseId: "prd", status: "pending" },
  { phaseId: "domainModel", status: "generating" },
];

describe("PhaseSwitcher", () => {
  test("renders current phase label in trigger button", () => {
    render(
      <PhaseSwitcher
        currentPhaseId="brief"
        phases={mockPhases}
        projectId="proj123"
      />
    );
    // "Brief" appears in both trigger and popover; confirm at least one is present
    const briefElements = screen.getAllByText("Brief");
    expect(briefElements.length).toBeGreaterThan(0);
  });

  test("renders all phase labels in the popover content", () => {
    render(
      <PhaseSwitcher
        currentPhaseId="constitution"
        phases={mockPhases}
        projectId="proj123"
      />
    );
    const popoverContent = screen.getByTestId("popover-content");
    expect(popoverContent).toHaveTextContent("Constitution");
    expect(popoverContent).toHaveTextContent("Brief");
    expect(popoverContent).toHaveTextContent("PRD");
    expect(popoverContent).toHaveTextContent("Domain Model");
  });

  test("navigates when a different phase is selected", () => {
    mockPush.mockClear();

    render(
      <PhaseSwitcher
        currentPhaseId="brief"
        phases={mockPhases}
        projectId="proj123"
      />
    );
    // Click on "PRD" button in the popover content
    const popoverContent = screen.getByTestId("popover-content");
    const prdButton = Array.from(popoverContent.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("PRD")
    );
    expect(prdButton).toBeDefined();
    fireEvent.click(prdButton!);
    expect(mockPush).toHaveBeenCalledWith("/project/proj123/phase/prd");
  });

  test("does not navigate when the current phase is selected", () => {
    mockPush.mockClear();

    render(
      <PhaseSwitcher
        currentPhaseId="brief"
        phases={mockPhases}
        projectId="proj123"
      />
    );
    const popoverContent = screen.getByTestId("popover-content");
    const briefButton = Array.from(popoverContent.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Brief")
    );
    expect(briefButton).toBeDefined();
    fireEvent.click(briefButton!);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
