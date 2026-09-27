import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { SectionQuality, StageReport } from "@/lib/quality/stage-report";
import { buildStageReport } from "@/lib/quality/stage-report";
import { getSectionPlansForPhase, PRD_SECTIONS } from "@/lib/llm/section-plans";

/**
 * The query is mocked rather than the report, because what this file tests is which stage the preview
 * asks for and where the answer is rendered. `mockUseQuery` records its arguments so the skipped case
 * can be asserted by what was passed rather than by what was drawn.
 */
const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") return undefined;
      return new Proxy({}, handler);
    },
  };
  return { api: new Proxy({}, handler) };
});

vi.mock("@/components/ui/mermaid-diagram", () => ({
  MermaidDiagram: ({ chart, className }: { chart: string; className?: string }) => (
    <div data-testid="mermaid-diagram" data-chart={chart} className={className} />
  ),
}));

import { ArtifactPreview } from "../artifact-preview";

function section(overrides: Partial<SectionQuality> & Pick<SectionQuality, "phaseId">): SectionQuality {
  return {
    id: "architecture-overview",
    title: "Architecture Overview",
    headingKey: "architecture-overview",
    present: true,
    empty: false,
    words: 100,
    budgetWords: 1000,
    overBudget: false,
    ...overrides,
  };
}

/**
 * A stage report as the read path returns it: the design stage spans three phases, so its sections
 * carry the phase each belongs to and the first of them is not the artifact under test.
 */
const REPORT: StageReport = {
  traceability: { total: 2, traced: 1, untraced: 1 },
  testability: { total: 4, observable: 2, unobservable: 1, vague: 0, unclassified: 1 },
  coverage: { sections: 2, emptySections: 1, missingSections: 0, missingSectionIds: [] },
  length: { words: 1200, budgetWords: 6000, overBudget: false },
  sections: [
    // Same heading title as the section the artifact owns, but in a sibling phase, and empty there.
    section({ phaseId: "domainModel", empty: true, words: 5 }),
    section({
      id: "deep-modules",
      title: "Deep Module Interfaces",
      // The plan id and the anchor differ: `headingKey` is the anchor id of the heading the document
      // carries, which is the slug of the section's title.
      headingKey: "deep-module-interfaces",
      phaseId: "specs",
      words: 2000,
      budgetWords: 1000,
      overBudget: true,
    }),
  ],
};

const ARTIFACT = {
  _id: "artifact-1" as Id<"artifacts">,
  title: "Atlas architecture",
  type: "specifications",
  content: [
    "# Atlas architecture",
    "",
    "## Architecture Overview",
    "",
    "The contract this phase owns.",
    "",
    "## Deep Module Interfaces",
    "",
    "Inputs, outputs, and the error catalogue.",
  ].join("\n"),
  previewHtml: "",
  sections: [],
  phaseId: "specs",
};

describe("ArtifactPreview", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("renders the stage's report above the table of contents", () => {
    mockUseQuery.mockReturnValue({ report: REPORT, artifactVersionIds: [] });

    const { container } = render(<ArtifactPreview artifact={ARTIFACT} projectId="p1" />);

    const report = screen.getByRole("region", { name: "Requirement quality" });
    expect(report).toHaveTextContent("1 of 2 requirements traced, 1 untraced");
    expect(report).toHaveTextContent("2 of 4 criteria testable, 1 not observable, 1 unclassified");

    const toc = screen.getByRole("navigation", { name: "On this page" });
    expect(
      report.compareDocumentPosition(toc) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // And the document is still the thing the report introduces.
    expect(container.querySelector('h2[id="deep-module-interfaces"]')).not.toBeNull();
  });

  it("asks the read path for the stage the artifact belongs to", () => {
    mockUseQuery.mockReturnValue({ report: REPORT, artifactVersionIds: [] });

    render(<ArtifactPreview artifact={ARTIFACT} projectId="p1" />);

    expect(mockUseQuery.mock.calls[0][1]).toEqual({ projectId: "p1", stageId: "design" });
  });

  it("renders no report and skips the query for an artifact with no phase", () => {
    // The quick spec page passes no project phase, so there is no stage to report on. It must render
    // exactly what it rendered before the report existed.
    mockUseQuery.mockReturnValue(undefined);

    const { container } = render(
      <ArtifactPreview artifact={{ ...ARTIFACT, phaseId: undefined }} projectId="p1" />
    );

    expect(mockUseQuery.mock.calls[0][1]).toBe("skip");
    expect(screen.queryByRole("region", { name: "Requirement quality" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
    expect(container.querySelector('h2[id="deep-module-interfaces"]')).not.toBeNull();
  });

  it("marks the artifact's own phase and leaves a sibling phase's same-named heading alone", () => {
    mockUseQuery.mockReturnValue({ report: REPORT, artifactVersionIds: [] });

    // The report really does carry an empty section whose heading key matches this document's first
    // heading. Without filtering by phase, that heading would be marked in the wrong document.
    expect(
      REPORT.sections.some(
        (entry) => entry.phaseId === "domainModel" && entry.headingKey === "architecture-overview"
      )
    ).toBe(true);

    const { container } = render(<ArtifactPreview artifact={ARTIFACT} projectId="p1" />);

    expect(
      container.querySelector('h2[id="architecture-overview"] .section-mark')
    ).toBeNull();
    expect(
      container.querySelector('h2[id="deep-module-interfaces"] .section-mark')
    ).toHaveTextContent("over budget");
  });

  it("lands a mark on the heading of the document that contains it when two documents repeat it", () => {
    // Both documents carry the same heading text. Matching the stage's joined text anchors the prd
    // occurrence as `2-problem-statement-2`, which this artifact's document does not contain, so
    // the mark silently never rendered while the summary above still stated the count.
    const briefDocument = [
      "# Atlas brief",
      "",
      "## 2. Problem Statement",
      "",
      "The brief states the problem first.",
    ].join("\n");
    const prdDocument = [
      "# Atlas product requirements",
      "",
      "## 2. Problem Statement",
      "",
      Array.from({ length: 1500 }, () => "word").join(" "),
    ].join("\n");

    const report = buildStageReport({
      documents: [
        { phaseId: "brief", markdown: briefDocument },
        { phaseId: "prd", markdown: prdDocument },
      ],
      claims: [],
      sectionPlan: [...getSectionPlansForPhase("brief"), ...PRD_SECTIONS],
    });

    mockUseQuery.mockReturnValue({ report, artifactVersionIds: [] });

    const { container } = render(
      <ArtifactPreview
        artifact={{ ...ARTIFACT, phaseId: "prd", content: prdDocument }}
        projectId="p1"
      />
    );

    expect(
      container.querySelector('h2[id="2-problem-statement"] .section-mark')
    ).toHaveTextContent("over budget");
  });
});
