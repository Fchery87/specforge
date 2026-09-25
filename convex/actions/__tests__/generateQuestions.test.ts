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

  it("parseGrillQuestionsResponse handles markdown codeblocks and field aliases", async () => {
    const { parseGrillQuestionsResponse } = await import(
      "../generateQuestions"
    );
    const raw = "```json\n" + JSON.stringify({
      questions: [
        {
          question: "How will traffic spikes be absorbed?",
          recommended_answer: "Deploy Redis rate limiting and token bucket throttles.",
          options: ["Redis rate limiting", "Cloudflare rules", "No throttling"],
        },
      ],
    }) + "\n```";

    const parsed = parseGrillQuestionsResponse(raw);
    expect(parsed.length).toBe(1);
    expect(parsed[0].text).toContain("traffic spikes");
    expect(parsed[0].recommendedAnswer).toContain("Redis rate limiting");
    expect(parsed[0].suggestions?.length).toBe(3);
  });

  it("normalizeGrillQuestions guarantees recommendedAnswer and suggestions", async () => {
    const { normalizeGrillQuestions, GRILL_FALLBACK_QUESTIONS } = await import(
      "../generateQuestions"
    );
    // Question with missing recommendedAnswer and missing suggestions
    const ai = [{ text: "Bare Question" }];
    const fallback = GRILL_FALLBACK_QUESTIONS.specs;

    const normalized = normalizeGrillQuestions(ai, fallback, 2);
    expect(normalized.length).toBe(2);
    expect(normalized[0].text).toBe("Bare Question");
    expect(normalized[0].recommendedAnswer).toBeTruthy();
    expect(normalized[0].suggestions && normalized[0].suggestions.length > 0).toBe(true);
  });
});
