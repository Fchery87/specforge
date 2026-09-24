import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SpecForgeLogo } from "../ui/logo";

describe("SpecForgeLogo component", () => {
  it("renders the logo mark and brand wordmark by default", () => {
    render(<SpecForgeLogo />);

    expect(screen.getByAltText("SpecForge Mark")).toBeInTheDocument();
    expect(screen.getByText(/Spec/i)).toBeInTheDocument();
    expect(screen.getByText(/Forge/i)).toBeInTheDocument();
  });

  it("renders vector variant without an image tag", () => {
    const { container } = render(<SpecForgeLogo variant="vector" />);

    expect(screen.queryByAltText("SpecForge Mark")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText(/Forge/i)).toBeInTheDocument();
  });

  it("can hide the wordmark when showWordmark is false", () => {
    render(<SpecForgeLogo showWordmark={false} />);

    expect(screen.getByAltText("SpecForge Mark")).toBeInTheDocument();
    expect(screen.queryByText(/Spec/i)).not.toBeInTheDocument();
  });
});
