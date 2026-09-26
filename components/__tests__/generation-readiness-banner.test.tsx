import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GenerationReadinessBanner } from "../generation-readiness-banner";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("GenerationReadinessBanner", () => {
  test("renders the link to /settings and alert message when ready is false", () => {
    render(<GenerationReadinessBanner ready={false} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Connect a model to generate specs")
    ).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/settings");
  });

  test("renders nothing when ready is true", () => {
    const { container } = render(<GenerationReadinessBanner ready={true} />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
