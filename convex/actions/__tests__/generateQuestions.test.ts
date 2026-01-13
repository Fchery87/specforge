import { describe, it, expect } from "vitest";
import {
  buildQuestionPrompt,
  normalizeQuestions,
  selectQuestions,
} from "../generateQuestions";

describe("generateQuestions helpers", () => {
  it("buildQuestionPrompt includes project context and range", () => {
    const prompt = buildQuestionPrompt({
      title: "SpecForge",
      description: "Project description",
      phaseId: "specs",
      range: { min: 5, max: 8 },
    });

    expect(prompt).toContain("SpecForge");
    expect(prompt).toContain("Project description");
    expect(prompt).toContain("specs");
    expect(prompt).toContain("5");
    expect(prompt).toContain("8");
  });

  it("normalizeQuestions enforces min/max and filters empty", () => {
    const raw = [
      { text: "Q1" },
      { text: "Q2" },
      { text: "" },
      { text: "Q3" },
      { text: "Q4" },
      { text: "Q5" },
      { text: "Q6" },
      { text: "Q7" },
      { text: "Q8" },
      { text: "Q9" },
    ];

    const result = normalizeQuestions(raw, "brief", { min: 5, max: 8 });
    expect(result.length).toBe(8);
    expect(result[0].text).toBe("Q1");
    expect(result.every((q) => q.text.trim().length > 0)).toBe(true);
  });

  it("selectQuestions falls back when ai questions below min", () => {
    const base = [{ text: "B1" }, { text: "B2" }];
    const ai = [{ text: "A1" }];

    const result = selectQuestions(ai, base, { min: 2, max: 5 });
    expect(result.questions).toEqual(base);
    expect(result.aiGenerated).toBe(false);
  });
});
