import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckSourceForm, type PickerState } from "@/components/checks/check-source-form";

const ready: PickerState = {
  status: "ready",
  repository: "Fchery87/ledger",
  pullRequests: [
    { number: 12, title: "Longer invitations", state: "open", author: "Fchery87" },
    { number: 9, title: "Append-only entries", state: "merged", author: "Fchery87" },
  ],
};

describe("CheckSourceForm", () => {
  it("checks the chosen pull request", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CheckSourceForm picker={ready} onSubmit={onSubmit} />);

    expect(screen.getByRole("button", { name: "Run check" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "#9 Append-only entries, merged" }));
    fireEvent.click(screen.getByRole("button", { name: "Run check" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ kind: "pull_request", number: 9 }));
  });

  it("checks a commit range once both ends are named", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CheckSourceForm picker={ready} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Commit range" }));
    fireEvent.change(screen.getByLabelText("Base"), { target: { value: " main " } });
    expect(screen.getByRole("button", { name: "Run check" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Head"), { target: { value: "feature/invites" } });
    fireEvent.click(screen.getByRole("button", { name: "Run check" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ kind: "range", base: "main", head: "feature/invites" }));
  });

  it("offers only a pasted diff without a connected repository, and says how to connect one", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CheckSourceForm picker={{ status: "unconnected", reason: "This project has no connected repository." }} onSubmit={onSubmit} />);

    expect(screen.getByRole("button", { name: "Pull request" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Paste a diff" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/This project has no connected repository\. To pick a pull request, connect/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Diff"), { target: { value: "diff --git a/x b/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Run check" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ kind: "pasted", diff: "diff --git a/x b/x" }));
  });

  it("waits for the pull requests, and says when there are none", () => {
    const { rerender } = render(<CheckSourceForm picker={{ status: "loading" }} onSubmit={vi.fn()} />);
    expect(screen.getByText("Reading pull requests…")).toBeInTheDocument();

    rerender(<CheckSourceForm picker={{ status: "ready", repository: "Fchery87/ledger", pullRequests: [] }} onSubmit={vi.fn()} />);
    expect(screen.getByText("Fchery87/ledger has no open or recently merged pull requests.")).toBeInTheDocument();
  });

  it("shows why the check could not run", () => {
    render(<CheckSourceForm picker={ready} onSubmit={vi.fn()} error="GitHub no longer accepts the saved connection. Reconnect GitHub in Settings." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Reconnect GitHub in Settings.");
  });
});
