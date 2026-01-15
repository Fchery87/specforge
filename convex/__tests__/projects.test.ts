import { describe, it, expect } from "vitest";
import { applyAnswerUpdate, getNextUpdatedAt } from "../projects";

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

describe("getNextUpdatedAt", () => {
  it("returns now when now is newer than current", () => {
    expect(getNextUpdatedAt(1000, 2000)).toBe(2000);
  });

  it("returns current when now is older than current", () => {
    expect(getNextUpdatedAt(2000, 1000)).toBe(2000);
  });
});
