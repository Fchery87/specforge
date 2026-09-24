import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DecorativeText } from "../ui/decorative-text";

describe("DecorativeText", () => {
  it("renders text with aria-hidden set to true", () => {
    const { container } = render(<DecorativeText text="FORGE" />);

    expect(screen.getByText("FORGE")).toBeInTheDocument();
    const element = container.firstChild as HTMLElement;
    expect(element).toHaveAttribute("aria-hidden", "true");
    expect(element).toHaveClass("truncate");
    expect(element).toHaveClass("overflow-hidden");
  });

  it("applies the requested variant and opacity", () => {
    const { container } = render(
      <DecorativeText text="CREATE" variant="hero" opacity={10} />
    );

    const element = container.firstChild as HTMLElement;
    expect(element.style.opacity).toBe("0.1");
    expect(element).toHaveClass("text-[clamp(2.5rem,10vw,7.5rem)]");
  });
});
