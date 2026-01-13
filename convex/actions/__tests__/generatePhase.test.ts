import { describe, it, expect } from "vitest";
import {
  extractRelevantQuestions,
  stripLeadingHeading,
} from "../generatePhase";

describe("generatePhase helpers", () => {
  it("matches architecture-overview questions", () => {
    const questions = [
      { text: "Describe the architecture", answer: "A" },
      { text: "Unrelated", answer: "B" },
    ];
    const result = extractRelevantQuestions(questions as any, "architecture-overview");
    expect(result.length).toBe(1);
  });

  it("matches data-models-and-api questions", () => {
    const questions = [
      { text: "Data model and schema?", answer: "A" },
      { text: "Unrelated", answer: "B" },
    ];
    const result = extractRelevantQuestions(questions as any, "data-models-and-api");
    expect(result.length).toBe(1);
  });

  it("strips leading headings from content", () => {
    const content = "## Architecture Overview\n\nDetails here";
    expect(stripLeadingHeading(content)).toBe("Details here");
  });
});
