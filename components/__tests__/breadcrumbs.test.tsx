import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumbs } from "../breadcrumbs";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Breadcrumbs", () => {
  test("renders all breadcrumb labels", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Project", href: "/project/123" },
          { label: "Constitution" },
        ]}
      />
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("My Project")).toBeInTheDocument();
    expect(screen.getByText("Constitution")).toBeInTheDocument();
  });

  test("intermediate items render as links", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Current" },
        ]}
      />
    );
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  test("last item is NOT a link", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Current Page" },
        ]}
      />
    );
    const current = screen.getByText("Current Page");
    expect(current.closest("a")).toBeNull();
  });

  test("single item renders without separator", () => {
    render(<Breadcrumbs items={[{ label: "Only Item" }]} />);
    expect(screen.getByText("Only Item")).toBeInTheDocument();
    // No chevron separator for single item
    expect(screen.queryByTestId("chevron-separator")).not.toBeInTheDocument();
  });

  test("has correct aria-label for accessibility", () => {
    render(<Breadcrumbs items={[{ label: "Dashboard" }]} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });
});
