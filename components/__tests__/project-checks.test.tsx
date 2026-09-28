import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { ProjectChecks } from "@/components/checks/project-checks";

const push = vi.fn();
const listPullRequests = vi.fn();
const checkPullRequest = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useAction: (ref: FunctionReference<"action">) =>
    getFunctionName(ref) === "actions/checkPullRequest:listPullRequests" ? listPullRequests : checkPullRequest,
}));

describe("ProjectChecks", () => {
  beforeEach(() => {
    push.mockReset();
    listPullRequests.mockReset();
    checkPullRequest.mockReset();
  });

  it("reads the repository's pull requests when opened, runs the check and opens its report", async () => {
    listPullRequests.mockResolvedValue({
      connected: true,
      repository: "Fchery87/ledger",
      pullRequests: [{ number: 12, title: "Longer invitations", state: "open", author: "Fchery87", updatedAt: "", url: "" }],
    });
    checkPullRequest.mockResolvedValue({ checkId: "vr9" });
    render(<ProjectChecks projectId={"p1" as never} />);

    fireEvent.click(screen.getByRole("button", { name: "Check a pull request" }));
    fireEvent.click(await screen.findByRole("radio", { name: "#12 Longer invitations, open" }));
    fireEvent.click(screen.getByRole("button", { name: "Run check" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/project/p1/check/vr9"));
    expect(listPullRequests).toHaveBeenCalledWith({ projectId: "p1" });
    expect(checkPullRequest).toHaveBeenCalledWith({ projectId: "p1", source: { kind: "pull_request", number: 12 } });
  });

  it("keeps the dialog open with the reason when the check cannot run", async () => {
    listPullRequests.mockResolvedValue({ connected: false, reason: "GitHub is not connected." });
    checkPullRequest.mockRejectedValue(new Error("This project has no requirements to check against yet. Generate its documents first."));
    render(<ProjectChecks projectId={"p1" as never} />);

    fireEvent.click(screen.getByRole("button", { name: "Check a pull request" }));
    fireEvent.change(await screen.findByLabelText("Diff"), { target: { value: "diff --git a/x b/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Run check" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This project has no requirements to check against yet.");
    expect(push).not.toHaveBeenCalled();
  });
});
