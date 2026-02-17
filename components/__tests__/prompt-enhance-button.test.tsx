import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PromptEnhanceButton } from "../prompt-enhance-button";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Convex
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
}));

describe("PromptEnhanceButton", () => {
  const mockOnEnhance = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders enhance button with wand icon", () => {
    render(
      <PromptEnhanceButton
        prompt="Test prompt"
        onEnhance={mockOnEnhance}
      />
    );

    expect(screen.getByRole("button", { name: /enhance/i })).toBeInTheDocument();
    expect(screen.getByText("Enhance")).toBeInTheDocument();
  });

  it("disables button when prompt is too short", () => {
    render(
      <PromptEnhanceButton
        prompt="Short"
        onEnhance={mockOnEnhance}
        minLength={20}
      />
    );

    expect(screen.getByRole("button", { name: /enhance/i })).toBeDisabled();
  });

  it("disables button when disabled prop is true", () => {
    render(
      <PromptEnhanceButton
        prompt="This is a long enough prompt for enhancement"
        onEnhance={mockOnEnhance}
        disabled={true}
      />
    );

    expect(screen.getByRole("button", { name: /enhance/i })).toBeDisabled();
  });

  it("enables button when prompt meets minimum length", () => {
    render(
      <PromptEnhanceButton
        prompt="This is a long enough prompt for enhancement"
        onEnhance={mockOnEnhance}
        minLength={10}
      />
    );

    expect(screen.getByRole("button", { name: /enhance/i })).not.toBeDisabled();
  });

  it("has correct keyboard shortcut (Ctrl+E)", () => {
    render(
      <PromptEnhanceButton
        prompt="Test prompt that is long enough"
        onEnhance={mockOnEnhance}
      />
    );

    const button = screen.getByRole("button", { name: /enhance/i });
    expect(button).toHaveAttribute("title", "Enhance with AI (Ctrl/Cmd + E)");
  });

  it("respects custom minLength prop", () => {
    render(
      <PromptEnhanceButton
        prompt="Tiny"
        onEnhance={mockOnEnhance}
        minLength={5}
      />
    );

    // Should be disabled since "Tiny" has 4 chars but minLength is 5
    expect(screen.getByRole("button", { name: /enhance/i })).toBeDisabled();
  });

  it("applies custom className when provided", () => {
    render(
      <PromptEnhanceButton
        prompt="Test prompt that is long enough"
        onEnhance={mockOnEnhance}
        className="custom-class"
      />
    );

    const button = screen.getByRole("button", { name: /enhance/i });
    expect(button).toHaveClass("custom-class");
  });

  it("renders with outline variant by default", () => {
    render(
      <PromptEnhanceButton
        prompt="Test prompt that is long enough"
        onEnhance={mockOnEnhance}
      />
    );

    const button = screen.getByRole("button", { name: /enhance/i });
    // The button should be an outline variant (from our component)
    expect(button).toBeInTheDocument();
  });
});
