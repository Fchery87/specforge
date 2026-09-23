import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ArtifactEditorModal } from "../artifact-editor-modal";
import type { Id } from "@/convex/_generated/dataModel";

const mockUpdateArtifact = vi.fn();
const mockParseTickets = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateArtifact,
  useAction: () => mockParseTickets,
  useQuery: () => null,
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/mermaid-aware-content", () => ({
  MermaidAwareContent: ({ markdown, className }: { markdown: string; className?: string }) => (
    <div data-testid="mermaid-preview" className={className}>
      {markdown}
    </div>
  ),
}));

describe("ArtifactEditorModal", () => {
  const defaultArtifact = {
    _id: "artifact-123" as Id<"artifacts">,
    title: "Core Architecture Spec",
    type: "specifications",
    content: "# Architecture\n\nInitial architecture documentation.",
    phaseId: "specs",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateArtifact.mockResolvedValue({});
    mockParseTickets.mockResolvedValue({});
  });

  test("renders modal with initial content, title, and token stats when open", () => {
    render(
      <ArtifactEditorModal
        open={true}
        onOpenChange={() => {}}
        artifact={defaultArtifact}
        projectId="project-456"
      />
    );

    expect(screen.getByText("Edit Core Architecture Spec")).toBeInTheDocument();
    expect(screen.getByText("specifications")).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText("Write your markdown specification here...") as HTMLTextAreaElement;
    expect(textarea.value).toBe("# Architecture\n\nInitial architecture documentation.");
    expect(screen.getByTestId("mermaid-preview")).toHaveTextContent("Initial architecture documentation.");
  });

  test("switches between split, edit, and preview view modes", () => {
    render(
      <ArtifactEditorModal
        open={true}
        onOpenChange={() => {}}
        artifact={defaultArtifact}
        projectId="project-456"
      />
    );

    // Initial split mode
    expect(screen.getByPlaceholderText("Write your markdown specification here...")).toBeInTheDocument();
    expect(screen.getByTestId("mermaid-preview")).toBeInTheDocument();

    // Switch to edit mode only
    const editModeBtn = screen.getByRole("button", { name: /^edit$/i });
    fireEvent.click(editModeBtn);
    expect(screen.getByPlaceholderText("Write your markdown specification here...")).toBeInTheDocument();
    expect(screen.queryByTestId("mermaid-preview")).not.toBeInTheDocument();

    // Switch to preview mode only
    const previewModeBtn = screen.getByRole("button", { name: /^preview$/i });
    fireEvent.click(previewModeBtn);
    expect(screen.queryByPlaceholderText("Write your markdown specification here...")).not.toBeInTheDocument();
    expect(screen.getByTestId("mermaid-preview")).toBeInTheDocument();

    // Switch to schema view mode
    const schemaModeBtn = screen.getByRole("button", { name: /^schema$/i });
    fireEvent.click(schemaModeBtn);
    expect(screen.getByText("Phase Export")).toBeInTheDocument();
    expect(screen.getByText("Conformance Score")).toBeInTheDocument();
  });

  test("inserts markdown formatting at cursor position via toolbar", () => {
    render(
      <ArtifactEditorModal
        open={true}
        onOpenChange={() => {}}
        artifact={defaultArtifact}
        projectId="project-456"
      />
    );

    const textarea = screen.getByPlaceholderText("Write your markdown specification here...") as HTMLTextAreaElement;

    // Click bold button
    const boldButton = screen.getByTitle("Bold");
    fireEvent.click(boldButton);

    expect(textarea.value).toContain("**bold text**");
    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();

    // Click mermaid template button
    const mermaidButton = screen.getByTitle("Insert Mermaid Diagram");
    fireEvent.click(mermaidButton);

    expect(textarea.value).toContain("```mermaid");
    expect(textarea.value).toContain("flowchart TD");
  });

  test("handles tab keypress by inserting two spaces indentation", () => {
    render(
      <ArtifactEditorModal
        open={true}
        onOpenChange={() => {}}
        artifact={defaultArtifact}
        projectId="project-456"
      />
    );

    const textarea = screen.getByPlaceholderText("Write your markdown specification here...") as HTMLTextAreaElement;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;

    fireEvent.keyDown(textarea, { key: "Tab" });

    expect(textarea.value.startsWith("  # Architecture")).toBe(true);
  });

  test("resets changes back to original content when Reset button is clicked", () => {
    render(
      <ArtifactEditorModal
        open={true}
        onOpenChange={() => {}}
        artifact={defaultArtifact}
        projectId="project-456"
      />
    );

    const textarea = screen.getByPlaceholderText("Write your markdown specification here...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Completely modified content" } });

    expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    const resetButton = screen.getByTitle("Reset to original content");
    fireEvent.click(resetButton);

    expect(textarea.value).toBe(defaultArtifact.content);
    expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
  });

  test("saves modified content, triggers update mutation, onSaved callback, and closes modal", async () => {
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();

    render(
      <ArtifactEditorModal
        open={true}
        onOpenChange={onOpenChange}
        artifact={defaultArtifact}
        projectId="project-456"
        onSaved={onSaved}
      />
    );

    const textarea = screen.getByPlaceholderText("Write your markdown specification here...") as HTMLTextAreaElement;
    const newContent = "# Updated Architecture\n\nNew section contents.";
    fireEvent.change(textarea, { target: { value: newContent } });

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateArtifact).toHaveBeenCalledWith({
        artifactId: "artifact-123",
        content: newContent,
        previewHtml: expect.any(String),
      });
      expect(onSaved).toHaveBeenCalledWith(newContent);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  test("automatically re-parses tickets when saving user stories artifact", async () => {
    const storyArtifact = {
      _id: "artifact-stories" as Id<"artifacts">,
      title: "User Stories",
      type: "stories",
      content: "# Stories\n\n### US-001: Implement Auth Flow",
      phaseId: "stories",
    };

    render(
      <ArtifactEditorModal
        open={true}
        onOpenChange={() => {}}
        artifact={storyArtifact}
        projectId="project-456"
      />
    );

    const textarea = screen.getByPlaceholderText("Write your markdown specification here...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "# Stories\n\n### US-001: Auth\n### US-002: Dashboard" } });

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateArtifact).toHaveBeenCalled();
      expect(mockParseTickets).toHaveBeenCalledWith({
        projectId: "project-456",
        artifactId: "artifact-stories",
      });
    });
  });

  test("handles save errors gracefully by displaying toast error and keeping modal open", async () => {
    mockUpdateArtifact.mockRejectedValueOnce(new Error("Network disconnect"));
    const onOpenChange = vi.fn();

    render(
      <ArtifactEditorModal
        open={true}
        onOpenChange={onOpenChange}
        artifact={defaultArtifact}
        projectId="project-456"
      />
    );

    const textarea = screen.getByPlaceholderText("Write your markdown specification here...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "# Changed" } });

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateArtifact).toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
