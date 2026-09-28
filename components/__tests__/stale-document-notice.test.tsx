import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StaleDocumentNotice } from "../stale-document-notice";

describe("StaleDocumentNotice", () => {
  it("says why the document is out of date and regenerates on request", () => {
    const onRegenerate = vi.fn();
    render(<StaleDocumentNotice reason="CHG-0003 applied" onRegenerate={onRegenerate} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "This document is out of date: CHG-0003 applied. Regenerate it to bring it in line with the requirements."
    );
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("turns Regenerate off when generation cannot run", () => {
    render(<StaleDocumentNotice onRegenerate={vi.fn()} disabled />);

    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDisabled();
  });
});
