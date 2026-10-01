import { describe, it, expect } from "vitest";
import {
  buildQuestionPrompt,
  mergeRegeneratedQuestions,
  normalizeQuestions,
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

  it("buildQuestionPrompt names exactly the phase's registry sections and asks for feeds", () => {
    const prompt = buildQuestionPrompt({
      title: "SpecForge",
      description: "Project description",
      phaseId: "brief",
      range: { min: 5, max: 8 },
    });

    for (const id of ["executive-summary", "problem-and-objectives", "features-and-requirements"]) {
      expect(prompt).toContain(`- ${id}:`);
    }
    expect(prompt).not.toContain("target-audience");
    expect(prompt).toContain('"feeds":["section-id"]');
  });

  it("buildQuestionPrompt lists questions already answered so they are not repeated", () => {
    const prompt = buildQuestionPrompt({
      title: "SpecForge",
      description: "Project description",
      phaseId: "brief",
      range: { min: 5, max: 8 },
      alreadyAsked: ["Who is it for?"],
    });

    expect(prompt).toContain("Do not repeat or rephrase them:\n- Who is it for?");
  });

  it("normalizeQuestions drops a section id the phase does not have", () => {
    const brief = normalizeQuestions(
      [{ text: "Who is it for?", feeds: ["target-audience"] }],
      "brief",
      { min: 1, max: 5 },
    );
    expect(brief[0].feeds).toEqual([]);

    const specs = normalizeQuestions(
      [{ text: "Where are the seams?", feeds: ["deep-modules", "nope", "deep-modules"] }],
      "specs",
      { min: 1, max: 5 },
    );
    expect(specs[0].feeds).toEqual(["deep-modules"]);
  });
});

describe("mergeRegeneratedQuestions", () => {
  const answered = (id: string, text: string, answer: string) => ({
    id,
    text,
    answer,
    required: true,
    source: "phase" as const,
    feeds: [],
    answerOrigin: "user" as const,
  });
  const unanswered = (id: string, text: string) => ({ id, text });
  const range = { min: 3, max: 5 };

  it("keeps answered questions unchanged and replaces the unanswered ones", () => {
    const existing = [
      answered("q_a", "Who is it for?", "Agencies"),
      unanswered("q_b", "Old question 1"),
      answered("q_c", "What is the goal?", "Traceable specs"),
      unanswered("q_d", "Old question 2"),
      unanswered("q_e", "Old question 3"),
    ];

    const merged = mergeRegeneratedQuestions(
      existing as any,
      [{ text: "New 1" }, { text: "New 2" }, { text: "New 3" }, { text: "New 4" }],
      [{ text: "Fallback 1" }],
      range,
    );

    expect(merged.slice(0, 2)).toEqual([existing[0], existing[2]]);
    expect(merged.map((q) => q.text)).toEqual([
      "Who is it for?",
      "What is the goal?",
      "New 1",
      "New 2",
      "New 3",
    ]);
    expect(merged.slice(2).every((q) => q.id.startsWith("q_") && q.source === "phase")).toBe(true);
    expect(merged.map((q) => q.id)).not.toContain("q_b");
  });

  it("fills only the shortfall from the fallback and keeps the model's question first", () => {
    const merged = mergeRegeneratedQuestions(
      [],
      [{ text: "Model question" }],
      [{ text: "Fallback 1" }, { text: "Fallback 2" }, { text: "Fallback 3" }],
      range,
    );

    expect(merged.map((q) => q.text)).toEqual(["Model question", "Fallback 1", "Fallback 2"]);
  });

  it("never swaps the model's questions for fallback ones when it met the minimum", () => {
    const merged = mergeRegeneratedQuestions(
      [],
      [{ text: "M1" }, { text: "M2" }, { text: "M3" }],
      [{ text: "Fallback 1" }],
      range,
    );
    expect(merged.map((q) => q.text)).toEqual(["M1", "M2", "M3"]);
  });

  it("stores required as a real boolean, whatever the model wrote", () => {
    const merged = mergeRegeneratedQuestions(
      [],
      [{ text: "A", required: "true" as unknown as boolean }, { text: "B", required: true }, { text: "C" }],
      [],
      { min: 1, max: 5 },
    );
    expect(merged.map((q) => q.required)).toEqual([false, true, false]);
  });

  it("does not add a question twice, and keeps answered Stress-Test questions beyond the range", () => {
    const grill = { ...answered("q_g", "Grill question", "Answer"), source: "grill" as const };
    const merged = mergeRegeneratedQuestions(
      [answered("q_a", "Who is it for?", "Agencies"), grill] as any,
      [{ text: "who is it for?" }, { text: "M1" }, { text: "M2" }],
      [],
      range,
    );

    expect(merged.map((q) => q.text)).toEqual(["Who is it for?", "Grill question", "M1", "M2"]);
  });

  it("keeps every answered question when the range is already full", () => {
    const existing = Array.from({ length: 6 }, (_, i) => answered(`q_${i}`, `Q${i}`, "A"));
    const merged = mergeRegeneratedQuestions(existing as any, [{ text: "New" }], [], range);
    expect(merged).toEqual(existing);
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

  it("normalizeGrillQuestions never invents a recommendation for the model's question", async () => {
    const { normalizeGrillQuestions, GRILL_FALLBACK_QUESTIONS } = await import(
      "../generateQuestions"
    );
    const fallback = GRILL_FALLBACK_QUESTIONS.specs;

    const normalized = normalizeGrillQuestions(
      [
        { text: "Bare Question" },
        { text: "Options only", suggestions: ["Option A", "Option B"] },
      ],
      fallback,
      2,
      "specs",
    );

    expect(normalized).toEqual([
      { text: "Bare Question", recommendedAnswer: undefined, suggestions: undefined, feeds: [] },
      {
        text: "Options only",
        recommendedAnswer: undefined,
        suggestions: ["Option A", "Option B"],
        feeds: [],
      },
    ]);
  });

  it("normalizeGrillQuestions keeps a fallback question's own recommendation and drops unknown feeds", async () => {
    const { normalizeGrillQuestions, GRILL_FALLBACK_QUESTIONS } = await import(
      "../generateQuestions"
    );
    const fallback = GRILL_FALLBACK_QUESTIONS.specs;

    const normalized = normalizeGrillQuestions(
      [{ text: "Where are the seams?", recommendedAnswer: " Inject I/O. ", feeds: ["test-seams", "nope"] }],
      fallback,
      2,
      "specs",
    );

    expect(normalized[0]).toMatchObject({ recommendedAnswer: "Inject I/O.", feeds: ["test-seams"] });
    expect(normalized[1].text).toBe(fallback[0].text);
    expect(normalized[1].recommendedAnswer).toBe(fallback[0].recommendedAnswer);
  });

  it("a phase with no fallback list gets no fallback questions", async () => {
    const { normalizeGrillQuestions, GRILL_FALLBACK_QUESTIONS } = await import(
      "../generateQuestions"
    );
    expect(GRILL_FALLBACK_QUESTIONS["made-up-phase"]).toBeUndefined();
    expect(normalizeGrillQuestions([], GRILL_FALLBACK_QUESTIONS["made-up-phase"] ?? [], 3, "made-up-phase")).toEqual([]);
  });

  it("buildGrillRoundPrompt asks for project-based recommendations and feeds, not a house style", async () => {
    const { buildGrillRoundPrompt } = await import("../generateQuestions");
    const prompt = buildGrillRoundPrompt({
      title: "SpecForge",
      description: "AI specification system",
      phaseId: "specs",
      count: 3,
    });

    expect(prompt).not.toContain("2026");
    expect(prompt).not.toContain("tracer bullets");
    expect(prompt).toContain("Base it on this project's own rules");
    expect(prompt).toContain("omit \"recommendedAnswer\"");
    expect(prompt).toContain("architecture-overview, deep-modules, test-seams, data-models-and-api, deployment-and-security");
    expect(prompt).toContain('"feeds": ["section-id"]');
  });
});
