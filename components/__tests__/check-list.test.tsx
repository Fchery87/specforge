import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckList } from "@/components/checks/check-list";

describe("CheckList", () => {
  it("invites a first check when there are none", () => {
    render(<CheckList projectId="p1" checks={[]} />);
    expect(screen.getByText(/No checks yet\./)).toBeInTheDocument();
  });

  it("names each check by its outcome and what it read, and links to its report", () => {
    render(
      <CheckList
        projectId="p1"
        checks={[
          {
            _id: "vr2",
            checkedAt: 200,
            status: "fail",
            outdatedAt: 250,
            source: { kind: "pull_request", number: 12, title: "Longer invitations", url: "u", baseSha: "b", headSha: "h" },
            counts: { critical: 1, major: 2, minor: 0 },
          },
          { _id: "vr1", checkedAt: 100, status: "pass", phaseId: "specs", counts: { critical: 0, major: 0, minor: 0 } },
        ]}
      />,
    );

    const [latest, older] = screen.getAllByRole("link");
    expect(latest).toHaveAttribute("href", "/project/p1/check/vr2");
    expect(latest).toHaveTextContent("Failed");
    expect(latest).toHaveTextContent("#12 Longer invitations");
    expect(latest).toHaveTextContent("Outdated");
    expect(latest).toHaveTextContent("1 critical, 2 major");
    expect(older).toHaveTextContent("Passed");
    expect(older).toHaveTextContent("Pasted diff, Architecture");
    expect(older).toHaveTextContent("No problems");
    expect(latest).toHaveAccessibleName(`#12 Longer invitations: failed, 1 critical, 2 major, outdated, ${new Date(200).toLocaleDateString()}`);
  });
});
