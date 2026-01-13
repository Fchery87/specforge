import { describe, it, expect } from "vitest";
import { getToastMessage } from "../notifications";

describe("toast messages", () => {
  it("returns text for question generation events", () => {
    expect(getToastMessage("questions_start").title).toBe("Generating questions");
    expect(getToastMessage("questions_done").title).toBe("Questions ready");
  });

  it("returns text for AI answer events", () => {
    expect(getToastMessage("ai_answer_start").title).toBe("AI answering");
    expect(getToastMessage("ai_answer_done").title).toBe("AI answer ready");
  });

  it("returns text for phase and export events", () => {
    expect(getToastMessage("phase_start").title).toBe("Phase generating");
    expect(getToastMessage("phase_done").title).toBe("Phase ready");
    expect(getToastMessage("phase_continued").title).toBe("Phase extended");
    expect(getToastMessage("export_start").title).toBe("Preparing export");
    expect(getToastMessage("export_done").title).toBe("Export ready");
  });

  it("returns text for artifact deletion events", () => {
    expect(getToastMessage("artifact_delete_start").title).toBe("Deleting artifact");
    expect(getToastMessage("artifact_delete_done").title).toBe("Artifact deleted");
    expect(getToastMessage("artifact_delete_error").title).toBe("Artifact deletion failed");
  });
});
