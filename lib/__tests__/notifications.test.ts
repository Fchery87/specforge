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
});
