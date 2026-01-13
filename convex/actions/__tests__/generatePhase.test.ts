import { describe, it, expect } from "vitest";
import {
  extractRelevantQuestions,
  generateSectionContent,
  planSectionsForPhase,
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

  it("continues when the model truncates output", async () => {
    const responses = [
      { content: "Part 1", finishReason: "length" },
      { content: "Part 2", finishReason: "stop" },
    ];
    const llmClient = {
      complete: async () => responses.shift(),
    } as any;

    const result = await generateSectionContent({
      projectContext: { title: "T", description: "D", questions: "" },
      sectionName: "test",
      sectionInstructions: "",
      sectionQuestions: [],
      previousSections: [],
      model: {
        id: "m",
        provider: "openai",
        contextTokens: 1,
        maxOutputTokens: 2000,
        defaultMax: 1000,
      },
      maxTokens: 2000,
      llmClient,
      providerInfo: "",
      phaseId: "brief",
    });

    expect(result.content).toContain("Part 1");
    expect(result.content).toContain("Part 2");
    expect(result.continued).toBe(true);
  });

  it("expands section plan when budget is too small", () => {
    const plan = planSectionsForPhase({
      sectionNames: ["architecture-overview"],
      estimatedTokens: 12000,
      model: {
        id: "m",
        provider: "openai",
        contextTokens: 1,
        maxOutputTokens: 4000,
        defaultMax: 2000,
      },
    });

    expect(plan.length).toBe(4);
  });
});
