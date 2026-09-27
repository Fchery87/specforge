import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GenerationControls } from "../generation-controls";

describe("GenerationControls", () => {
  it("shows Cancel while generating and calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <GenerationControls
        isGenerating
        canGenerate
        onGenerate={() => {}}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows Resume Generation when canResume is true and calls onResume", async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(
      <GenerationControls
        isGenerating={false}
        canGenerate={true}
        canResume={true}
        onResume={onResume}
        onGenerate={() => {}}
      />
    );

    const resumeBtn = screen.getByRole("button", { name: /resume generation/i });
    expect(resumeBtn).toBeInTheDocument();
    await user.click(resumeBtn);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("turns Generate off and says why when no model is connected", () => {
    render(
      <GenerationControls isGenerating={false} canGenerate onGenerate={() => {}} modelReady={false} />
    );

    expect(screen.getByRole("button", { name: "Generate Phase" })).toBeDisabled();
    expect(screen.getByText(/to generate\./)).toHaveTextContent("Connect a model in Settings to generate.");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });
});
