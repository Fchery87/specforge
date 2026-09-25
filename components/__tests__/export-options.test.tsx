import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportOptionsPanel } from "../export-options";

vi.mock("convex/react", () => ({
  useConvex: () => ({
    query: vi.fn().mockResolvedValue({ claims: [] }),
  }),
}));

describe("ExportOptionsPanel", () => {
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
});
