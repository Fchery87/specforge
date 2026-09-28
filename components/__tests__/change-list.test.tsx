import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangeList } from "../changes/change-list";

describe("ChangeList", () => {
  it("names each change by ID, title, kind and status, linked to its page", () => {
    render(
      <ChangeList
        projectId="p1"
        changes={[
          { _id: "ch2", changeNumber: 2, kind: "bugfix", title: "Invite links show a 404", status: "draft" },
          { _id: "ch1", changeNumber: 1, kind: "feature", title: "Invite with a link", status: "applied" },
        ]}
      />
    );
    const rows = within(screen.getByRole("list", { name: "Changes" })).getAllByRole("link");

    expect(rows.map((row) => row.textContent)).toEqual([
      "CHG-0002Invite links show a 404Bug fixDraft",
      "CHG-0001Invite with a linkFeature changeApplied",
    ]);
    expect(rows[0]).toHaveAttribute("href", "/project/p1/change/ch2");
  });

  it("invites a first change when there are none", () => {
    render(<ChangeList projectId="p1" changes={[]} />);

    expect(screen.getByText(/No changes yet/)).toBeInTheDocument();
  });
});
