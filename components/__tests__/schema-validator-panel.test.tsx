import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SchemaValidatorPanel } from "../schema-validator-panel";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("SchemaValidatorPanel", () => {
  const sampleMarkdown = `# Core Architecture Spec

This is an architecture spec.

\`\`\`json
{
  "api": "v1",
  "name": "specforge"
}
\`\`\`

## Endpoints
GET /api/v1/projects
POST /api/v1/projects
`;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders phase export JSON by default with syntax valid status", () => {
    render(
      <SchemaValidatorPanel
        markdownContent={sampleMarkdown}
        phaseId="specs"
        artifactTitle="Architecture Spec"
        artifactType="specifications"
      />
    );

    expect(screen.getByText("Phase Export")).toBeInTheDocument();
    expect(screen.getByText("Syntax Valid")).toBeInTheDocument();
    expect(screen.getByText("Conformance Score")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("Schema definitions will render here...") as HTMLTextAreaElement;
    expect(textarea.value).toContain('"type": "specifications"');
    expect(textarea.value).toContain('"title": "Architecture Spec"');
  });

  it("switches to YAML mode and back to JSON", () => {
    render(
      <SchemaValidatorPanel
        markdownContent={sampleMarkdown}
        phaseId="specs"
        artifactTitle="Architecture Spec"
        artifactType="specifications"
      />
    );

    const yamlButton = screen.getByRole("button", { name: "YAML" });
    fireEvent.click(yamlButton);

    const textarea = screen.getByPlaceholderText("Schema definitions will render here...") as HTMLTextAreaElement;
    expect(textarea.value).toContain("type: specifications");
    expect(textarea.value).toContain("title: Architecture Spec");

    const jsonButton = screen.getByRole("button", { name: "JSON" });
    fireEvent.click(jsonButton);
    expect(textarea.value).toContain('"type": "specifications"');
  });

  it("switches to code block mode and selects embedded JSON blocks", () => {
    render(
      <SchemaValidatorPanel
        markdownContent={sampleMarkdown}
        phaseId="specs"
        artifactTitle="Architecture Spec"
        artifactType="specifications"
      />
    );

    const codeBlockModeBtn = screen.getByRole("button", { name: /Code Blocks/i });
    fireEvent.click(codeBlockModeBtn);

    const textarea = screen.getByPlaceholderText("Schema definitions will render here...") as HTMLTextAreaElement;
    expect(textarea.value).toContain('"api": "v1"');
    expect(textarea.value).toContain('"name": "specforge"');
  });

  it("detects and displays syntax errors when invalid JSON is typed", () => {
    render(
      <SchemaValidatorPanel
        markdownContent={sampleMarkdown}
        phaseId="specs"
        artifactTitle="Architecture Spec"
        artifactType="specifications"
      />
    );

    const textarea = screen.getByPlaceholderText("Schema definitions will render here...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{\n  "badJson": true,\n}' } });

    expect(screen.getByText("Syntax Error")).toBeInTheDocument();
  });

  it("formats JSON with 2 spaces indentation when Format button is clicked", () => {
    render(
      <SchemaValidatorPanel
        markdownContent={sampleMarkdown}
        phaseId="specs"
        artifactTitle="Architecture Spec"
        artifactType="specifications"
      />
    );

    const textarea = screen.getByPlaceholderText("Schema definitions will render here...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"unformatted":true,"count":42}' } });

    const formatButton = screen.getByRole("button", { name: /^Format$/i });
    fireEvent.click(formatButton);

    expect(textarea.value).toContain('{\n  "unformatted": true,\n  "count": 42\n}');
  });

  it("copies schema to clipboard", async () => {
    render(
      <SchemaValidatorPanel
        markdownContent={sampleMarkdown}
        phaseId="specs"
        artifactTitle="Architecture Spec"
        artifactType="specifications"
      />
    );

    const copyButton = screen.getByRole("button", { name: /Copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  it("calls onApplyToMarkdown when Sync to Markdown button is clicked", () => {
    const onApply = vi.fn();

    render(
      <SchemaValidatorPanel
        markdownContent={sampleMarkdown}
        phaseId="specs"
        artifactTitle="Architecture Spec"
        artifactType="specifications"
        onApplyToMarkdown={onApply}
      />
    );

    const syncButton = screen.getByRole("button", { name: /Sync to Markdown/i });
    fireEvent.click(syncButton);

    expect(onApply).toHaveBeenCalled();
  });

  it("calls onInsertSnippet when quick fix button is clicked", () => {
    const onInsertSnippet = vi.fn();

    render(
      <SchemaValidatorPanel
        markdownContent={sampleMarkdown}
        phaseId="specs"
        artifactTitle="Architecture Spec"
        artifactType="specifications"
        onInsertSnippet={onInsertSnippet}
      />
    );

    const testSeamButton = screen.getByRole("button", { name: /Add Explicit Test Seams/i });
    fireEvent.click(testSeamButton);

    expect(onInsertSnippet).toHaveBeenCalledWith(expect.stringContaining("Explicit Test Seams"));
  });
});
