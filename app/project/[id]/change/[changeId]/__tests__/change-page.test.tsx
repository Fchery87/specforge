import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import ChangePage from "../page";

const applyChange = vi.fn();
const draftChange = vi.fn();
let change: Record<string, unknown>;
let project: Record<string, unknown> | null;

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p1", changeId: "ch1" }),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name === "projects:getProject") return project;
    if (name === "projects:getProjectPhases") return [{ phaseId: "prd", status: "ready" }];
    if (name === "artifacts:getAllProjectArtifacts") return [{ phaseId: "prd" }];
    if (name === "changes:getChange") {
      return {
        change,
        ops: [
          {
            _id: "o1", order: 0, reason: "Links too.", evidenceSourceIds: [],
            op: { type: "modify", claim: "c12", baseText: "Owners invite by email.", text: "Owners invite by email or link." },
            target: { claimId: "REQ-0012", text: "Owners invite by SMS.", phaseId: "prd", live: true },
          },
        ],
      };
    }
    return undefined;
  },
  useMutation: (ref: FunctionReference<"mutation">) => (getFunctionName(ref) === "changes:applyChange" ? applyChange : vi.fn()),
  useAction: () => draftChange,
}));

describe("ChangePage", () => {
  beforeEach(() => {
    project = { _id: "p1", title: "Ledger", mode: "full", skippedPhases: [] };
    change = {
      _id: "ch1", projectId: "p1", changeNumber: 3, kind: "bugfix", title: "Invite links 404", summary: "Opening a link shows a 404.",
      bug: { observed: "A 404 page.", expected: "The invite page.", reproduction: "Open an invite link." }, status: "draft",
    };
    applyChange.mockReset();
    draftChange.mockReset();
  });

  it("names the change and shows the bug report and its edits", () => {
    render(<ChangePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Invite links 404" })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "Bug fix CHG-0003")).toBeInTheDocument();
    expect(screen.getByText("Open an invite link.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Edits" })).toHaveTextContent("RewordedREQ-0012");
  });

  it("applies after confirmation, and marks the conflicting edit when nothing applied", async () => {
    applyChange.mockResolvedValue({
      status: "conflict",
      conflicts: [{ order: 0, claimId: "REQ-0012", reason: "The requirement was reworded after this change was drafted" }],
    });
    render(<ChangePage />);

    fireEvent.click(screen.getByRole("button", { name: "Apply change" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Apply CHG-0003?" })).getByRole("button", { name: "Apply change" }));

    await waitFor(() => expect(screen.getByText("Nothing was applied.")).toBeInTheDocument());
    expect(applyChange).toHaveBeenCalledWith({ changeId: "ch1" });
    expect(within(screen.getByRole("list", { name: "Edits" })).getByRole("alert")).toHaveTextContent("reworded after this change was drafted");
  });

  it("shows what the draft dropped", async () => {
    draftChange.mockResolvedValue({ operations: 1, notes: ["Drafted edit 2 targeted REQ-0999, which is not a current requirement, and was dropped."] });
    render(<ChangePage />);

    fireEvent.click(screen.getByRole("button", { name: "Draft again" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Draft the edits again?" })).getByRole("button", { name: "Draft again" }));

    await waitFor(() => expect(screen.getByText(/REQ-0999, which is not a current requirement/)).toBeInTheDocument());
  });

  it("offers no controls once the change is applied", () => {
    change = { ...change, status: "applied", appliedAt: Date.UTC(2026, 8, 27) };
    render(<ChangePage />);

    expect(screen.queryByRole("button", { name: "Apply change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Drop" })).not.toBeInTheDocument();
    expect(screen.getByText(/^Applied on/)).toBeInTheDocument();
  });

  it("refuses a change opened under another project's address", () => {
    change = { ...change, projectId: "p2" };
    render(<ChangePage />);

    expect(screen.getByRole("heading", { level: 1, name: "This change belongs to another project" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Edits" })).not.toBeInTheDocument();
  });

  it("says so when the project is gone", () => {
    project = null;
    render(<ChangePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Project not found" })).toBeInTheDocument();
  });
});

