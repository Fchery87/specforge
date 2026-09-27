import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportOptionsPanel } from "../export-options";
import type { StageQualityForExport } from "@/lib/quality/stage-report";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn<(query: unknown, args?: unknown) => unknown>(() => undefined),
}));

vi.mock("convex/react", () => ({
  useConvex: () => ({
    query: vi.fn().mockResolvedValue({ claims: [] }),
  }),
  useQuery: mocks.useQuery,
}));

const measuredStage: StageQualityForExport = {
  stageId: "requirements",
  stageLabel: "Requirements",
  traceability: { total: 4, traced: 3, untraced: 1 },
  testability: {
    total: 5,
    observable: 3,
    unobservable: 1,
    vague: 1,
    unclassified: 0,
  },
  coverage: {
    sections: 3,
    emptySections: 1,
    missingSections: 1,
    missingSectionIds: ["risks"],
  },
  length: { words: 900, budgetWords: 800, overBudget: true },
  untestableCriteria: ["Archiving should be fast.", "Handle edge cases."],
};

/** jsdom's Blob has no text(), so a capture reads back through FileReader. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("ExportOptionsPanel", () => {
  beforeEach(() => {
    mocks.useQuery.mockReturnValue(undefined);
  });

  const baseProject = {
    _id: "p1",
    title: "SpecForge Demo",
    description: "Export Options Test",
    createdAt: 1700000000000,
  };

  it("lists the 4 allowed export formats and offers handoff notes when missing", () => {
    render(
      <ExportOptionsPanel
        project={baseProject}
        artifacts={{
          brief: "# Brief",
          constitution: "{}",
        }}
        onDownloadZip={vi.fn()}
        isDownloadingZip={false}
      />
    );

    // Verify 4 options
    expect(screen.getByText("Project ZIP")).toBeInTheDocument();
    expect(screen.getByText("Agent Skill (SKILL.md)")).toBeInTheDocument();
    expect(screen.getByText("Agent Guide (AGENTS.md)")).toBeInTheDocument();
    expect(screen.getByText("Markdown Bundle")).toBeInTheDocument();

    // Verify removed clipboard options are absent
    expect(screen.queryByText("Copy for Claude Code")).not.toBeInTheDocument();
    expect(screen.queryByText("Copy for Cursor")).not.toBeInTheDocument();

    // Verify handoff offer is present and ZIP is enabled
    expect(screen.getByText("Generate handoff notes")).toBeInTheDocument();
    const zipButton = screen.getByRole("button", { name: /project zip/i });
    expect(zipButton).not.toBeDisabled();
  });

  it("does not offer handoff notes when handoff artifact exists", () => {
    render(
      <ExportOptionsPanel
        project={baseProject}
        artifacts={{
          brief: "# Brief",
          handoff: "# Handoff notes",
        }}
        onDownloadZip={vi.fn()}
        isDownloadingZip={false}
      />
    );

    expect(screen.queryByText("Generate handoff notes")).not.toBeInTheDocument();
  });

  it("writes the requirement-quality report and the untestable criteria into the exported AGENTS.md", async () => {
    mocks.useQuery.mockReturnValue([measuredStage]);

    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:mock";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    render(
      <ExportOptionsPanel
        project={baseProject}
        artifacts={{ brief: "# Brief" }}
        onDownloadZip={vi.fn()}
        isDownloadingZip={false}
      />
    );

    expect(mocks.useQuery).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
    });

    fireEvent.click(screen.getByRole("button", { name: /agent guide/i }));
    await vi.waitFor(() => expect(blobs).toHaveLength(1));

    const content = await readBlob(blobs[0]);
    expect(content).toContain("## Requirement quality");
    expect(content).toContain("- 3 of 4 requirements traced");
    expect(content).toContain("- 1 untraced");
    expect(content).toContain("- 3 of 5 criteria testable");
    expect(content).toContain("### Untestable criteria");
    expect(content).toContain("- Archiving should be fast.");
    expect(content).toContain("- Handle edge cases.");
  });
});
