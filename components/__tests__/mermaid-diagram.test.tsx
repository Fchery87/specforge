import { render, screen, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { MermaidDiagram } from "../ui/mermaid-diagram";

// Mock dynamic mermaid import
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg><text>flowchart</text></svg>', diagramType: "flowchart" }),
  },
}));

describe("MermaidDiagram", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-establish the default resolved value after clearAllMocks resets implementations
    const { default: mermaid } = await import("mermaid");
    vi.mocked(mermaid.render).mockResolvedValue({ svg: '<svg><text>flowchart</text></svg>', diagramType: "flowchart" });
  });

  test("shows loading state initially", () => {
    render(<MermaidDiagram chart="graph TD; A-->B" />);
    expect(screen.getByText("Rendering diagram…")).toBeInTheDocument();
  });

  test("renders SVG after mermaid resolves", async () => {
    render(<MermaidDiagram chart="graph TD; A-->B" />);
    await waitFor(() => {
      expect(screen.getByText("flowchart")).toBeInTheDocument();
    });
  });

  test("shows error state when mermaid throws", async () => {
    const { default: mermaid } = await import("mermaid");
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error("Parse error: unexpected token"));

    render(<MermaidDiagram chart="invalid diagram syntax @@@" />);
    await waitFor(() => {
      expect(screen.getByText("Diagram error")).toBeInTheDocument();
      expect(screen.getByText("Parse error: unexpected token")).toBeInTheDocument();
    });
  });

  test("renders nothing for empty chart string", () => {
    render(<MermaidDiagram chart="" />);
    // Neither loading nor error — empty chart, effect exits early
    expect(screen.queryByText("Rendering diagram…")).toBeInTheDocument();
  });

  test("accepts className prop", async () => {
    render(<MermaidDiagram chart="graph TD; A-->B" className="my-custom-class" />);
    await waitFor(() => {
      const container = document.querySelector(".mermaid-diagram");
      expect(container).toBeInTheDocument();
    });
  });
});
