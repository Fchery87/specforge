import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageQualityReport } from "../stage-report";
import { parseClaimManifest } from "@/lib/claims";
import { PRD_SECTIONS } from "@/lib/llm/section-plans";
import { buildStageReport } from "@/lib/quality/stage-report";

/**
 * The report is rendered with no provider, no Convex and no model credentials, which is the property
 * the product depends on: a user can read a stage's requirement quality on a deployment that has no
 * LLM configured, and on an artifact they edited by hand.
 */

const CLAIMS = parseClaimManifest(
  [
    "- **C-1** [confirmed; reviewed]: A requirement. — Evidence: lib/a.ts (abc123, supports)",
    "- **C-2** [unresolved; pending]: Another requirement. — Evidence not captured",
  ].join("\n")
);

/** The row for one dimension, found through its term so the label and the value stay together. */
function dimensionRow(container: HTMLElement, label: string): HTMLElement {
  const term = within(container).getByText(label);
  const row = term.closest("div");
  if (!row) throw new Error(`no row for ${label}`);
  return row as HTMLElement;
}

describe("StageQualityReport", () => {
  it("reports the four dimensions as four separate values", () => {
    const report = buildStageReport({
      documents: [{ phaseId: "prd", markdown: ["# PRD", "", "## Requirements", "", "- **C-1** [confirmed; reviewed]: A requirement. — Evidence: lib/a.ts (abc123, supports)"].join("\n") }],
      claims: CLAIMS,
      sectionPlan: PRD_SECTIONS,
      criteria: ["Archiving a project returns 204 for an editor."],
      criterionClassList: ["observable"],
    });

    const { container } = render(<StageQualityReport report={report} />);

    const list = container.querySelector("dl");
    expect(list).not.toBeNull();

    const terms = within(list as HTMLElement).getAllByRole("term");
    expect(terms.map((term) => term.textContent)).toEqual([
      "Traceability",
      "Testability",
      "Coverage",
      "Length",
    ]);
    expect(within(list as HTMLElement).getAllByRole("definition")).toHaveLength(4);
  });

  it("prints no percentage and no combined score", () => {
    const report = buildStageReport({ documents: [], claims: CLAIMS, sectionPlan: PRD_SECTIONS });
    const { container } = render(<StageQualityReport report={report} />);

    // A blended number would hide which of the four is wrong, so none is reported at all.
    expect(container.textContent).not.toContain("%");
    expect(container.textContent).not.toContain("/100");
    expect(container.textContent ?? "").not.toMatch(/score|overall|total score/i);
  });

  it("says a stage has no recorded requirements rather than inventing a trace", () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: [] });
    const { container } = render(<StageQualityReport report={report} />);

    const row = dimensionRow(container, "Traceability");
    expect(row).toHaveTextContent("No requirements recorded yet");
    expect(row).toHaveTextContent("Capture evidence against this stage's answers");
    // No zero dressed up as a result, and no percentage of nothing.
    expect(row).not.toHaveTextContent("0 of 0");
    expect(row.textContent).not.toContain("%");
  });

  it("reports each testability class separately and omits a class at zero", () => {
    const report = buildStageReport({
      documents: [],
      claims: [],
      sectionPlan: [],
      criteria: ["Returns 204.", "Should be fast.", "A criterion from before the class existed."],
      criterionClassList: ["observable", "unobservable"],
    });

    const { container } = render(<StageQualityReport report={report} />);
    const row = dimensionRow(container, "Testability");

    expect(row).toHaveTextContent("1 of 3 criteria testable");
    expect(row).toHaveTextContent("1 not observable");
    expect(row).toHaveTextContent("1 unclassified");
    // The class with nothing in it is left out rather than printed as a zero.
    expect(row).not.toHaveTextContent("vague");
  });

  it("says a stage recorded no acceptance criteria", () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: [] });
    const { container } = render(<StageQualityReport report={report} />);

    expect(dimensionRow(container, "Testability")).toHaveTextContent(
      "No acceptance criteria recorded."
    );
  });

  it("names the missing sections rather than only counting them", () => {
    const report = buildStageReport({
      documents: [
        {
          phaseId: "prd",
          markdown: [
            "## Executive Summary",
            "",
            "- **C-1** [confirmed; reviewed]: A requirement. — Evidence: lib/a.ts (abc123, supports)",
          ].join("\n"),
        },
      ],
      claims: [],
      sectionPlan: PRD_SECTIONS,
    });

    const { container } = render(<StageQualityReport report={report} />);
    const row = dimensionRow(container, "Coverage");

    expect(row).toHaveTextContent("1 of 4 sections present");
    expect(row).toHaveTextContent("3 missing");
    for (const id of report.coverage.missingSectionIds) {
      expect(row).toHaveTextContent(id);
    }
  });

  it("counts the empty sections it found", () => {
    const report = buildStageReport({
      documents: [{ phaseId: "prd", markdown: ["## Executive Summary", "", "Prose with no requirement."].join("\n") }],
      claims: [],
      sectionPlan: PRD_SECTIONS,
    });

    const { container } = render(<StageQualityReport report={report} />);

    expect(dimensionRow(container, "Coverage")).toHaveTextContent("1 of 4 sections present, 1 empty");
  });

  it("names the section count when a section is over budget", () => {
    const long = Array.from({ length: 1500 }, () => "word").join(" ");
    // The PRD's second section is budgeted 1000 words, so this is 50 percent past it while the stage
    // as a whole stays inside its own budget.
    const report = buildStageReport({
      documents: [{ phaseId: "prd", markdown: ["## Problem Statement", "", long].join("\n") }],
      claims: [],
      sectionPlan: PRD_SECTIONS,
    });

    const { container } = render(<StageQualityReport report={report} />);
    const row = dimensionRow(container, "Length");

    expect(row).toHaveTextContent(`${report.length.words} of ${report.length.budgetWords} words`);
    expect(row).toHaveTextContent("1 section over budget");
    // The stage itself is inside its budget, so it does not claim to be over.
    expect(report.length.overBudget).toBe(false);
  });

  it("says no budget was recorded instead of reporting a document as over a budget of nothing", () => {
    // An empty plan makes `isOverBudget` answer true for any non-empty document, since there is no
    // budget to be inside. Reporting that as "over budget" would be a fact about the missing plan
    // dressed up as a fact about the document.
    const report = buildStageReport({
      documents: [{ phaseId: "prd", markdown: "one two three" }],
      claims: [],
      sectionPlan: [],
    });

    expect(report.length).toHaveProperty("budgetWords", 0);

    const { container } = render(<StageQualityReport report={report} />);
    const row = dimensionRow(container, "Length");

    expect(row).toHaveTextContent("3 words, no budget recorded");
    expect(row).not.toHaveTextContent("over budget");
    expect(row).not.toHaveTextContent("of 0 words");
  });

  it("labels the whole report, so the region has an accessible name", () => {
    const report = buildStageReport({ documents: [], claims: [], sectionPlan: [] });
    render(<StageQualityReport report={report} />);

    expect(
      screen.getByRole("region", { name: "Requirement quality" })
    ).toBeInTheDocument();
  });
});
