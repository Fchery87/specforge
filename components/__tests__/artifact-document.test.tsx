import { render, screen } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { ArtifactDocument } from "../artifact-document";
import { sectionMarksFor } from "@/lib/markdown-render";
import { buildStageReport } from "@/lib/quality/stage-report";
import { PRD_SECTIONS, type SectionPlanConfig } from "@/lib/llm/section-plans";

vi.mock("@/components/ui/mermaid-diagram", () => ({
  MermaidDiagram: ({ chart, className }: { chart: string; className?: string }) => (
    <div data-testid="mermaid-diagram" data-chart={chart} className={className} />
  ),
}));

const MARKDOWN = [
  "# Atlas product requirements",
  "",
  "Atlas keeps a project's evidence in one place.",
  "",
  "## 1. Scope",
  "",
  "Atlas covers intake and handoff.",
  "",
  "### 1.1 Archive a project",
  "",
  "A member with the editor role may archive a project.",
  "",
  "## Requirement Traceability",
  "",
  "- **C-014** [confirmed; reviewed]: An editor may archive a project. — Evidence: lib/authz.ts (4f2a91c, supports)",
  "- **C-015** [unresolved; pending]: Audit events are retained. — Evidence not captured",
].join("\n");

describe("ArtifactDocument", () => {
  test("renders headings as anchors and lists them in the table of contents", () => {
    const { container } = render(<ArtifactDocument markdown={MARKDOWN} title="Atlas" />);

    expect(container.querySelector("h1#atlas-product-requirements")).toBeInTheDocument();
    expect(container.querySelector('h2[id="1-scope"]')).toBeInTheDocument();
    expect(container.querySelector('h3[id="1-1-archive-a-project"]')).toBeInTheDocument();

    const toc = screen.getByRole("navigation", { name: "Contents" });
    expect(toc).toBeInTheDocument();
    expect(toc.querySelectorAll("a")).toHaveLength(4);
    expect(toc.querySelector('a[href="#1-scope"]')).toBeInTheDocument();
  });

  test("keeps a mermaid diagram a diagram and keeps later anchors aligned", () => {
    const markdown = [
      "# Title",
      "",
      "```mermaid",
      "graph TD",
      "  A --> B",
      "```",
      "",
      "## After the diagram",
      "",
      "Prose after.",
    ].join("\n");

    const { container } = render(<ArtifactDocument markdown={markdown} />);

    const diagram = screen.getByTestId("mermaid-diagram");
    expect(diagram).toHaveAttribute("data-chart", "graph TD\n  A --> B");
    // The heading cursor must resume after the fence, or this anchor gets the wrong id.
    expect(container.querySelector("h1#title")).toBeInTheDocument();
    expect(container.querySelector("h2#after-the-diagram")).toBeInTheDocument();
  });

  test("marks claim bullets with their evidence state", () => {
    const { container } = render(<ArtifactDocument markdown={MARKDOWN} />);

    expect(container.querySelector('li[data-claim="C-014"]')).toHaveAttribute(
      "data-state",
      "confirmed"
    );
    expect(container.querySelector('li[data-claim="C-015"]')).toHaveAttribute(
      "data-state",
      "untraced"
    );
  });

  test("reports unsettled claims per section in the gap map", () => {
    render(<ArtifactDocument markdown={MARKDOWN} />);

    const traceability = screen.getByRole("link", { name: /Requirement Traceability/ });
    expect(traceability).toHaveTextContent("2 claims, untraced");
  });

  test("totals the document's claims by state at the foot of the gap map", () => {
    render(<ArtifactDocument markdown={MARKDOWN} />);
    const totals = screen.getByRole("list", { name: "Claims in this document" });

    expect(totals).toHaveTextContent(/Confirmed\s*1/);
    expect(totals).toHaveTextContent(/Proposed\s*0/);
    expect(totals).toHaveTextContent(/Untraced\s*1/);
  });

  test("puts the contents before the document, so it reads as a left rail", () => {
    const { container } = render(<ArtifactDocument markdown={MARKDOWN} title="Atlas" />);
    const toc = screen.getByRole("navigation", { name: "Contents" });
    const article = container.querySelector("article");

    expect(article).not.toBeNull();
    expect(toc.compareDocumentPosition(article as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("renders the body without a table of contents when there are no headings", () => {
    render(<ArtifactDocument markdown="Just a paragraph, with no headings at all." />);

    expect(screen.getByText("Just a paragraph, with no headings at all.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Contents" })).not.toBeInTheDocument();
  });

  test("strips a script tag out of the rendered body", () => {
    const { container } = render(
      <ArtifactDocument markdown={"# Title\n\n<script>alert(1)</script>"} />
    );

    expect(container.querySelector("script")).not.toBeInTheDocument();
  });
});

/**
 * The regression lock for the numbered-heading defect.
 *
 * A numbered heading anchors as the slug of its whole text, so `## 2. Problem Statement` is
 * `2-problem-statement` while the plan knows the section as `Problem Statement`. Matching on the
 * title slug alone found no section at all, and recording the title slug handed `renderSpecHtml` a
 * key no heading carries, so the mark silently never appeared on a numbered document. The path
 * through the real report is the point: a caller-supplied mark would prove nothing.
 */
describe("ArtifactDocument section marks", () => {
  /** The PRD's second section, budgeted 1500 tokens, which is a 1000-word budget. */
  const problemStatement = PRD_SECTIONS.find((entry) => entry.id === 'problem-statement') as SectionPlanConfig;
  const long = Array.from({ length: 1500 }, () => "word").join(" ");

  const markdown = [
    "# Atlas product requirements",
    "",
    "## 1. Executive Summary",
    "",
    "An overview.",
    "",
    "## 2. Problem Statement",
    "",
    long,
  ].join("\n");

  const report = buildStageReport({
    documents: [{ phaseId: "prd", markdown }],
    claims: [],
    sectionPlan: PRD_SECTIONS,
  });
  const marks = sectionMarksFor(report.sections);

  test("places the over-budget mark on the numbered heading it belongs to", () => {
    expect(problemStatement.id).toBe("problem-statement");
    expect(report.sections.find((entry) => entry.id === "problem-statement")?.overBudget).toBe(true);

    const { container } = render(
      <ArtifactDocument markdown={markdown} title="Atlas product requirements" sectionMarks={marks} />
    );

    const heading = container.querySelector('h2[id="2-problem-statement"]');
    expect(heading).not.toBeNull();
    expect(heading?.querySelector(".section-mark")).toHaveTextContent("over budget");
    // The unnumbered anchor is not a heading this document has, so nothing lands on it.
    expect(container.querySelector('h2[id="problem-statement"]')).toBeNull();
  });

  test("places the empty mark on a numbered heading whose section carries no claim", () => {
    const emptyMarkdown = [
      "# Atlas product requirements",
      "",
      "## 1. Executive Summary",
      "",
      "- **C-1** [confirmed; reviewed]: A requirement. — Evidence: lib/a.ts (abc123, supports)",
      "",
      "## 2. Problem Statement",
      "",
      "Prose with no requirement behind it.",
    ].join("\n");

    const emptyReport = buildStageReport({
      documents: [{ phaseId: "prd", markdown: emptyMarkdown }],
      claims: [],
      sectionPlan: PRD_SECTIONS,
    });

    expect(emptyReport.sections.find((entry) => entry.id === "problem-statement")?.empty).toBe(true);

    const { container } = render(
      <ArtifactDocument
        markdown={emptyMarkdown}
        title="Atlas product requirements"
        sectionMarks={sectionMarksFor(emptyReport.sections)}
      />
    );

    expect(
      container.querySelector('h2[id="2-problem-statement"] .section-mark')
    ).toHaveTextContent("empty");
    // The section that does carry a claim gets no mark.
    expect(
      container.querySelector('h2[id="1-executive-summary"] .section-mark')
    ).toBeNull();
  });
});
