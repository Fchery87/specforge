import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/mermaid-diagram", () => ({
  MermaidDiagram: ({ chart, className }: { chart: string; className?: string }) => (
    <div data-testid="mermaid-diagram" data-chart={chart} className={className} />
  ),
}));

// The preview renders project rows, which reach for Convex. Their data arrives as props, so the
// queries are skipped and a stub is enough.
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

import DesignPreviewPage from "@/app/design/page";

/**
 * The development preview is the only place this change can be seen without a Convex deployment, a
 * generated project and model credentials. So the two things it exists to show are asserted here: the
 * report of a real stage and both mark states on a numbered heading.
 */
describe("design preview", () => {
  it("renders the report and both section marks from the real plan", () => {
    const { container } = render(<DesignPreviewPage />);

    const report = screen.getByRole("region", { name: "Requirement quality" });
    expect(report).toHaveTextContent("of 2 requirements traced, 1 untraced");
    expect(report).toHaveTextContent("1 not observable");
    // The coverage line names the section that is absent, on its own line, not only its count.
    expect(report).toHaveTextContent("1 missing");
    expect(report).toHaveTextContent("requirements");

    const marks = [...container.querySelectorAll(".section-mark")].map((mark) => ({
      heading: mark.closest("h2")?.id ?? "",
      word: mark.textContent,
    }));

    // A numbered heading anchors as the slug of its whole text, so these ids prove the mark reached
    // the heading the reader sees rather than a title slug the document has no heading for.
    expect(marks).toEqual([
      { heading: "1-executive-summary", word: "empty" },
      { heading: "2-success-metrics", word: "over budget" },
    ]);
  });

  it("keeps the first example renderable without a report", () => {
    const { container } = render(<DesignPreviewPage />);

    // The unmeasured document from before this change still renders its numbered headings, and the
    // marks do not spill onto them: `1-scope` matches no plan section.
    expect(container.querySelector('h2[id="1-scope"]')).not.toBeNull();
    expect(container.querySelector('h2[id="1-scope"] .section-mark')).toBeNull();
  });

  it("shows the workspace and the project rows without a deployment", () => {
    render(<DesignPreviewPage />);

    expect(screen.getByRole("navigation", { name: "Workflow stages" })).toBeInTheDocument();
    expect(screen.getByText("Settle 2 untraced claims in Requirements")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Domain Model.*Generating/ })).toHaveAttribute(
      "aria-current",
      "step"
    );
    expect(screen.getByRole("link", { name: "Resume at Design" })).toBeInTheDocument();
  });
});
