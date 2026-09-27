import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SpecForgeLogo } from "../ui/logo";

describe("SpecForgeLogo component", () => {
  it("renders the mark as inline svg beside the wordmark", () => {
    const { container } = render(<SpecForgeLogo />);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("SpecForge")).toBeInTheDocument();
  });

  it("hides the mark from assistive tech when the wordmark already names it", () => {
    const { container } = render(<SpecForgeLogo />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("names the mark when the wordmark is hidden", () => {
    render(<SpecForgeLogo showWordmark={false} />);

    expect(screen.getByRole("img", { name: "SpecForge" })).toBeInTheDocument();
    expect(screen.queryByText("SpecForge")).not.toBeInTheDocument();
  });

  it("draws the tile and the section sign from theme tokens, not literals", () => {
    const { container } = render(<SpecForgeLogo />);
    const svg = container.querySelector("svg");

    expect(svg?.innerHTML).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(container.querySelector(".fill-brand")).toBeInTheDocument();
  });
});
