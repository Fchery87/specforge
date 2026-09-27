import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import ProjectQuickSpecPage from "../page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1" }),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name === "projects:getProject") return { _id: "p1", title: "Ledger" };
    if (name === "artifacts:getArtifactByPhase") return null;
    return undefined;
  },
}));

describe("ProjectQuickSpecPage", () => {
  it("names the page, links back to the project and invites a first quick spec", () => {
    render(<ProjectQuickSpecPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Saved quick specs" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute("href", "/project/p1");
    expect(screen.getByRole("link", { name: "New quick spec" })).toHaveAttribute("href", "/dashboard/quick");
    expect(screen.getByText(/No quick spec is saved to this project yet/)).toBeInTheDocument();
  });
});
