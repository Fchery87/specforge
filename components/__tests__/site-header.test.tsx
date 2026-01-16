import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { SiteHeader } from "../site-header";

let signedIn = false;
let isAdmin = false;

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isSignedIn: signedIn,
    user: signedIn
      ? {
          firstName: "Ada",
          publicMetadata: { role: isAdmin ? "admin" : undefined },
        }
      : null,
  }),
  UserButton: () => <div data-testid="user-button" />,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("SiteHeader mobile menu", () => {
  beforeEach(() => {
    signedIn = false;
    isAdmin = false;
  });

  it("shows signed-out actions in the mobile menu", async () => {
    signedIn = false;
    const user = userEvent.setup();

    render(<SiteHeader />);

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("link", { name: /login/i })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /get started/i })
    ).toBeInTheDocument();
  });

  it("shows navigation links in the mobile menu for signed-in users", async () => {
    signedIn = true;
    const user = userEvent.setup();

    render(<SiteHeader />);

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /settings/i })
    ).toBeInTheDocument();
  });
});
