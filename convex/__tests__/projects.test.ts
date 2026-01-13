import { describe, it, expect } from "vitest";
import { applyAnswerUpdate } from "../projects";

describe("applyAnswerUpdate", () => {
  it("updates answer and aiGenerated when provided", () => {
    const questions = [
      { id: "q1", text: "Q1", aiGenerated: false },
      { id: "q2", text: "Q2", aiGenerated: true },
    ];

    const result = applyAnswerUpdate(questions as any, "q1", "A1", true);
    expect(result[0].answer).toBe("A1");
    expect(result[0].aiGenerated).toBe(true);
  });

  it("updates answer without changing aiGenerated when undefined", () => {
    const questions = [
      { id: "q1", text: "Q1", aiGenerated: false },
    ];

    const result = applyAnswerUpdate(questions as any, "q1", "A1", undefined);
    expect(result[0].answer).toBe("A1");
    expect(result[0].aiGenerated).toBe(false);
  });
});
