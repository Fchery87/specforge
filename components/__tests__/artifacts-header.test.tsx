import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtifactsHeader } from "../artifacts-header";

describe("ArtifactsHeader", () => {
  it("shows Cancelled badge and helper text when cancelled", () => {
    render(
      <ArtifactsHeader
        streamStatus="cancelled"
        hasArtifacts
        onDownloadAll={() => {}}
        isDownloading={false}
      />
    );
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText("Partial output preserved. You can regenerate anytime.")).toBeInTheDocument();
  });
});

