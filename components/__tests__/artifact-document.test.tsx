import { render, screen } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { ArtifactDocument } from "../artifact-document";

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

    const toc = screen.getByRole("navigation", { name: "On this page" });
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

  test("renders the body without a table of contents when there are no headings", () => {
    render(<ArtifactDocument markdown="Just a paragraph, with no headings at all." />);

    expect(screen.getByText("Just a paragraph, with no headings at all.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "On this page" })).not.toBeInTheDocument();
  });

  test("strips a script tag out of the rendered body", () => {
    const { container } = render(
      <ArtifactDocument markdown={"# Title\n\n<script>alert(1)</script>"} />
    );

    expect(container.querySelector("script")).not.toBeInTheDocument();
  });
});
