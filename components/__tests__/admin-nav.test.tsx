import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AdminNav } from "../admin/admin-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
}));

describe("AdminNav", () => {
  it("renders the admin console brand and navigation items", () => {
    render(<AdminNav />);

    expect(screen.getByText("Admin Console")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ai & models/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^exit$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /exit admin/i })).toBeInTheDocument();
  });
});
