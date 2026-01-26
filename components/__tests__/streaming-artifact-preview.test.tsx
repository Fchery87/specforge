import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StreamingArtifactPreview } from "../streaming-artifact-preview";

describe("StreamingArtifactPreview", () => {
  it("shows a Live badge when streamStatus is streaming", () => {
    render(
      <StreamingArtifactPreview
        title="Doc"
        previewHtml="<p>Hi</p>"
        streamStatus="streaming"
      />
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows current section and progress when provided", () => {
    render(
      <StreamingArtifactPreview
        title="Doc"
        previewHtml="<p>Hi</p>"
        streamStatus="streaming"
        currentSection="requirements"
        sectionsCompleted={1}
        sectionsTotal={3}
      />
    );
    expect(
      screen.getByText((_, el) => el?.textContent === "Section 2 of 3: requirements")
    ).toBeInTheDocument();
  });
});
