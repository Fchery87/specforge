import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "../ui/button";

describe("Button", () => {
  it("presses to 0.97 so a click is acknowledged", () => {
    render(<Button>Start a spec</Button>);

    expect(screen.getByRole("button")).toHaveClass("active:scale-[0.97]");
  });

  it("drops the press movement under reduced motion", () => {
    render(<Button>Start a spec</Button>);

    expect(screen.getByRole("button")).toHaveClass("motion-reduce:active:scale-100");
  });

  it("transitions named properties rather than all of them", () => {
    render(<Button>Start a spec</Button>);
    const classes = screen.getByRole("button").className;

    expect(classes).not.toMatch(/\btransition-all\b/);
    expect(classes).toMatch(/transition-\[[^\]]*transform[^\]]*\]/);
  });

  it("gives the primary hover a different fill from its resting fill", () => {
    render(<Button>Start a spec</Button>);
    const button = screen.getByRole("button");

    expect(button).toHaveClass("bg-primary");
    expect(button).not.toHaveClass("hover:bg-brand");
    expect(button).not.toHaveClass("hover:bg-primary");
  });

  it("does not move on hover", () => {
    render(<Button variant="outline">Try a quick spec</Button>);

    expect(screen.getByRole("button").className).not.toMatch(/hover:(?:scale|-?translate)/);
  });
});
