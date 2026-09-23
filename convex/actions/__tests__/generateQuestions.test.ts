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

describe("grill-me helpers", () => {
  it("buildGrillRoundPrompt formats prompt with prior history and count", async () => {
    const { buildGrillRoundPrompt } = await import("../generateQuestions");
    const prompt = buildGrillRoundPrompt({
      title: "SpecForge",
      description: "AI specification system",
      phaseId: "specs",
      count: 3,
      upstreamAnswers: "Q: DB?\nA: PostgreSQL",
      priorGrillHistory: [
        { question: "Cache strategy?", answer: "Redis with 60s TTL" },
      ],
    });

    expect(prompt).toContain("SpecForge");
    expect(prompt).toContain("Stress-Test Plan");
    expect(prompt).toContain("Ask exactly 3 challenging");
    expect(prompt).toContain("PostgreSQL");
    expect(prompt).toContain("Cache strategy?");
    expect(prompt).toContain("recommendedAnswer");
  });

  it("parseGrillQuestionsResponse parses valid json with recommendedAnswer", async () => {
    const { parseGrillQuestionsResponse } = await import(
      "../generateQuestions"
    );
    const raw = JSON.stringify({
      questions: [
        {
          text: "How are idempotency keys tracked?",
          recommendedAnswer: "Store SHA-256 tokens in Redis with 24h expiration.",
          suggestions: ["Redis cache", "DB table", "In-memory map"],
        },
      ],
    });

    const parsed = parseGrillQuestionsResponse(raw);
    expect(parsed.length).toBe(1);
    expect(parsed[0].text).toContain("idempotency");
    expect(parsed[0].recommendedAnswer).toContain("SHA-256");
    expect(parsed[0].suggestions?.length).toBe(3);
  });

  it("normalizeGrillQuestions uses fallback when AI questions are insufficient", async () => {
    const { normalizeGrillQuestions, GRILL_FALLBACK_QUESTIONS } = await import(
      "../generateQuestions"
    );
    const ai = [{ text: "Custom Q1", recommendedAnswer: "Custom A1" }];
    const fallback = GRILL_FALLBACK_QUESTIONS.specs;

    const normalized = normalizeGrillQuestions(ai, fallback, 3);
    expect(normalized.length).toBe(3);
    expect(normalized[0].text).toBe("Custom Q1");
    expect(normalized[1].text).toBe(fallback[0].text);
  });
});
