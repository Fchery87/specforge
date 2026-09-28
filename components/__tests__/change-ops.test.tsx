import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeOps, type ChangeOpView } from "../changes/change-ops";

const target = (claimId: string, text: string) => ({ claimId, text, phaseId: "prd", live: true });
const ops: ChangeOpView[] = [
  { _id: "o1", order: 0, reason: "Asked for links.", evidenceSourceIds: [], op: { type: "add", phaseId: "prd", kind: "requirement", text: "Owners may share an invite link." }, target: null },
  { _id: "o2", order: 1, reason: "Links too.", evidenceSourceIds: ["s1"], op: { type: "modify", claim: "c12", baseText: "Owners invite by email.", text: "Owners invite by email or link." }, target: target("REQ-0012", "Owners invite by email.") },
  { _id: "o3", order: 2, reason: "No longer expires.", evidenceSourceIds: [], op: { type: "remove", claim: "c20", baseText: "Invites expire after a day." }, target: target("REQ-0020", "Invites expire after a day.") },
  { _id: "o4", order: 3, reason: "The spec is right.", evidenceSourceIds: [], op: { type: "reaffirm", claim: "c21", baseText: "Links open the invite page." }, target: target("REQ-0021", "Links open the invite page.") },
];
const drafts = ops.map(({ reason, evidenceSourceIds, op }) => ({ reason, evidenceSourceIds, op }));

describe("ChangeOps", () => {
  it("shows each edit as a diff against the current wording", () => {
    render(<ChangeOps ops={ops} />);
    const items = within(screen.getByRole("list", { name: "Edits" })).getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("AddedPRDOwners may share an invite link.Why: Asked for links.");
    expect(items[1]).toHaveTextContent("RewordedREQ-0012Owners invite by email.Owners invite by email or link.");
    expect(within(items[1]).getByText("Owners invite by email.")).toHaveClass("line-through");
    expect(within(items[2]).getByText("Invites expire after a day.")).toHaveClass("line-through");
    expect(items[3]).toHaveTextContent("ReaffirmedREQ-0021Links open the invite page.");
    expect(screen.queryByRole("button", { name: "Drop" })).not.toBeInTheDocument();
  });

  it("marks an edit that conflicts with the current requirements", () => {
    render(<ChangeOps ops={ops} conflicts={[{ order: 1, claimId: "REQ-0012", reason: "The requirement was reworded after this change was drafted" }]} />);

    expect(within(screen.getAllByRole("listitem")[1]).getByRole("alert")).toHaveTextContent("reworded after this change was drafted");
  });

  it("saves the list without a dropped edit", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ChangeOps ops={ops} editable onSave={onSave} />);

    fireEvent.click(within(screen.getAllByRole("listitem")[2]).getByRole("button", { name: "Drop" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([drafts[0], drafts[1], drafts[3]]));
  });

  it("saves new wording and a new reason for an edit", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ChangeOps ops={ops} editable onSave={onSave} />);

    fireEvent.click(within(screen.getAllByRole("listitem")[1]).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Wording"), { target: { value: "Owners invite by link only." } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Email is going away." } });
    fireEvent.click(screen.getByRole("button", { name: "Save edit" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        drafts[0],
        { reason: "Email is going away.", evidenceSourceIds: ["s1"], op: { type: "modify", claim: "c12", baseText: "Owners invite by email.", text: "Owners invite by link only." } },
        drafts[2],
        drafts[3],
      ])
    );
  });

  it("adds a requirement to a phase with a document, with the kind that phase implies", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ChangeOps ops={[]} editable phasesWithDocuments={["prd", "stories"]} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Add a requirement to"), { target: { value: "stories" } });
    fireEvent.change(screen.getByLabelText("New requirement"), { target: { value: "Given a link, when opened, then the invite loads." } });
    fireEvent.change(screen.getByLabelText("Why it is needed"), { target: { value: "Regression test." } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { reason: "Regression test.", evidenceSourceIds: [], op: { type: "add", phaseId: "stories", kind: "acceptance_criterion", text: "Given a link, when opened, then the invite loads." } },
      ])
    );
  });
});
