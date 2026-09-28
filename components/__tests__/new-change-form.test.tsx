import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewChangeForm } from "../changes/new-change-form";

describe("NewChangeForm", () => {
  it("submits a feature change with its title and description", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<NewChangeForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Invite with a link" } });
    fireEvent.change(screen.getByLabelText("What should change, and why"), { target: { value: "Typing emails is slow." } });
    fireEvent.click(screen.getByRole("button", { name: "Start change" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ kind: "feature", title: "Invite with a link", summary: "Typing emails is slow." })
    );
  });

  it("asks a bug fix for what happens, what should, and how to reproduce it", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<NewChangeForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Bug fix" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Invite links 404" } });
    fireEvent.change(screen.getByLabelText("What is wrong"), { target: { value: "The link is broken." } });
    fireEvent.change(screen.getByLabelText("What happens"), { target: { value: "A 404 page." } });
    fireEvent.change(screen.getByLabelText("What should happen"), { target: { value: "The invite page." } });
    expect(screen.getByRole("button", { name: "Start change" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Steps to reproduce"), { target: { value: "Open an invite link." } });
    fireEvent.click(screen.getByRole("button", { name: "Start change" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        kind: "bugfix",
        title: "Invite links 404",
        summary: "The link is broken.",
        bug: { observed: "A 404 page.", expected: "The invite page.", reproduction: "Open an invite link." },
      })
    );
  });

  it("shows the server's reason when a change cannot start", () => {
    render(<NewChangeForm onSubmit={vi.fn()} error="Generate the project's requirements before starting a change" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Generate the project's requirements before starting a change");
  });
});
