import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextActionPanel, nextActionCopy } from "../next-action-panel";

describe("nextActionCopy", () => {
  it("names the claims that block a stage under review", () => {
    const copy = nextActionCopy(
      { kind: "review", stageId: "requirements" },
      { requirements: { untraced: 2, unobservable: 0, vague: 0 } }
    );

    expect(copy.title).toBe("Settle 2 untraced claims in Requirements");
  });

  it("uses the singular for one claim", () => {
    const copy = nextActionCopy(
      { kind: "review", stageId: "design" },
      { design: { untraced: 1, unobservable: 0, vague: 0 } }
    );

    expect(copy.title).toBe("Settle 1 untraced claim in Design");
  });

  it("asks for a plain review when nothing is untraced", () => {
    expect(nextActionCopy({ kind: "review", stageId: "design" }, {}).title).toBe("Review Design");
  });

  it("names the phase for questions and generation", () => {
    expect(nextActionCopy({ kind: "answer", phaseId: "prd" }).title).toBe(
      "Answer the PRD questions"
    );
    expect(nextActionCopy({ kind: "generate", phaseId: "specs" }).title).toBe(
      "Generate the Architecture"
    );
  });

  it("says what continuing and exporting do", () => {
    expect(nextActionCopy({ kind: "continue", stageId: "tasks" }).title).toBe("Continue to Tasks");
    expect(nextActionCopy({ kind: "export" }).title).toBe("Export the handoff pack");
  });
});

describe("NextActionPanel", () => {
  it("renders the title, the reason, and one link that performs the action", () => {
    render(
      <NextActionPanel
        projectId="p1"
        action={{ kind: "review", stageId: "requirements" }}
        quality={{ requirements: { untraced: 2, unobservable: 0, vague: 0 } }}
      />
    );

    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Settle 2 untraced claims in Requirements")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review requirements/i })).toHaveAttribute(
      "href",
      "/project/p1/phase/brief"
    );
  });
});
