import { describe, it, expect } from "vitest";
import {
  applyAnswerUpdate,
  buildConstitutionTemplateSnapshot,
  getNextUpdatedAt,
  resolveSkippedPhasesForMode,
} from "../projects";

describe("buildConstitutionTemplateSnapshot", () => {
  it("copies template content and locked constraints onto the project snapshot", () => {
    const snapshot = buildConstitutionTemplateSnapshot({
      name: "Web application",
      constitutionContent: "Prefer accessible, keyboard friendly controls.",
      lockedConstraints: {
        architecture: "Modular monolith",
        securityProtocols: ["Validate authorization on the server"],
      },
    });

    expect(snapshot).toEqual({
      name: "Web application",
      constitutionContent: "Prefer accessible, keyboard friendly controls.",
      lockedConstraints: {
        architecture: "Modular monolith",
        securityProtocols: ["Validate authorization on the server"],
      },
    });
  });
});

describe("applyAnswerUpdate", () => {
  const questions = [
    { id: "q1", text: "Q1" },
    { id: "q2", text: "Q2", answer: "Old", answerOrigin: "drafted" },
  ];

  it("stores the answer and who wrote it, and leaves other questions alone", () => {
    const result = applyAnswerUpdate(questions as any, "q1", "A1", "user");
    expect(result[0]).toMatchObject({ id: "q1", answer: "A1", answerOrigin: "user" });
    expect(result[1]).toEqual(questions[1]);
  });

  it("records a model-written answer the user chose as accepted, and an unreviewed one as drafted", () => {
    expect(applyAnswerUpdate(questions as any, "q1", "A", "accepted")[0].answerOrigin).toBe("accepted");
    expect(applyAnswerUpdate(questions as any, "q1", "A", "drafted")[0].answerOrigin).toBe("drafted");
  });

  it("replaces a drafted origin when the user writes the answer", () => {
    expect(applyAnswerUpdate(questions as any, "q2", "New", "user")[1]).toMatchObject({
      answer: "New",
      answerOrigin: "user",
    });
  });

  it("updates selectedSuggestionIndex when provided", () => {
    const withOptions = [{ id: "q1", text: "Q1", suggestions: ["Opt 1", "Opt 2"] }];
    const result = applyAnswerUpdate(withOptions as any, "q1", "Opt 2", "accepted", 1);
    expect(result[0]).toMatchObject({ answer: "Opt 2", answerOrigin: "accepted", selectedSuggestionIndex: 1 });
  });
});

describe("grill answers", () => {
  it("marks a Stress-Test answer accepted or typed, and a new one as a grill question", async () => {
    const { mergeGrillAnswersIntoQuestions } = await import("../projects");
    const merged = mergeGrillAnswersIntoQuestions(
      [{ id: "q1", text: "Q1" }] as any,
      [
        { questionId: "q1", questionText: "Q1", answer: "A", acceptedRecommendation: true },
        { questionId: "q_new", questionText: "New", answer: "B", feeds: ["deep-modules"] },
      ],
    );
    expect(merged[0].answerOrigin).toBe("accepted");
    expect(merged[1]).toMatchObject({ id: "q_new", source: "grill", feeds: ["deep-modules"], answerOrigin: "user" });
  });
});

describe("withStoredGrillCount", () => {
  it("counts the Stress-Test questions that are stored", async () => {
    const { withStoredGrillCount } = await import("../projects");
    const session = { totalQuestionsAsked: 6, currentRound: 2, isComplete: false, rounds: [] };
    const stored = [{ source: "phase" as const }, { source: "phase" as const }, { source: "grill" as const }, { source: "grill" as const }];
    expect(withStoredGrillCount(session, stored)).toEqual({
      totalQuestionsAsked: 2,
      currentRound: 2,
      isComplete: false,
      rounds: [],
    });
  });

  it("completes the session at ten stored questions", async () => {
    const { withStoredGrillCount } = await import("../projects");
    const stored = Array.from({ length: 10 }, () => ({ source: "grill" as const }));
    expect(withStoredGrillCount({ totalQuestionsAsked: 0, isComplete: false }, stored).isComplete).toBe(true);
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

describe("grillSession helpers", () => {
  it("mergeGrillAnswersIntoQuestions updates existing and appends new", async () => {
    const { mergeGrillAnswersIntoQuestions } = await import("../projects");
    const existing = [
      { id: "q1", text: "Q1", answer: "Old A1" },
    ];
    const answers = [
      {
        questionId: "q1",
        questionText: "Q1",
        answer: "New A1",
        options: ["Opt 1"],
      },
      {
        questionId: "grill-q2",
        questionText: "Grill Q2",
        answer: "A2",
        options: ["Opt 2"],
      },
    ];

    const merged = mergeGrillAnswersIntoQuestions(existing as any, answers);
    expect(merged.length).toBe(2);
    expect(merged[0].answer).toBe("New A1");
    expect(merged[0].answerOrigin).toBe("user");
    expect(merged[1].id).toBe("grill-q2");
    expect(merged[1].answer).toBe("A2");
  });

  it("computeUpdatedGrillSession calculates total questions and rounds", async () => {
    const { computeUpdatedGrillSession } = await import("../projects");
    const existingSession = {
      totalQuestionsAsked: 2,
      currentRound: 1,
      isComplete: false,
      rounds: [
        {
          roundNumber: 1,
          questions: [
            {
              id: "prior-q1",
              text: "Prior Q1",
              recommendedAnswer: "Rec 1",
              userAnswer: "Prior A1",
            },
            {
              id: "prior-q2",
              text: "Prior Q2",
              recommendedAnswer: "Rec 2",
              userAnswer: "Prior A2",
            },
          ],
        },
      ],
    };

    const newAnswers = [
      {
        questionId: "grill-q3",
        questionText: "New Q3",
        answer: "New A3",
        recommendedAnswer: "Rec A3",
        acceptedRecommendation: true,
        round: 2,
      },
      {
        questionId: "grill-q4",
        questionText: "New Q4",
        answer: "New A4",
        recommendedAnswer: "Rec A4",
        acceptedRecommendation: true,
        round: 2,
      },
    ];

    const updated = computeUpdatedGrillSession(existingSession, newAnswers);
    expect(updated.totalQuestionsAsked).toBe(4);
    expect(updated.currentRound).toBe(2);
    expect(updated.isComplete).toBe(false);
    expect(updated.rounds.length).toBe(2);
    expect(updated.rounds[1].questions[0].text).toBe("New Q3");
  });
});

describe("resolveSkippedPhasesForMode", () => {
  it("stores ['domainModel', 'artifacts'] for a new 'quick' project", () => {
    expect(resolveSkippedPhasesForMode("quick")).toEqual([
      "domainModel",
      "artifacts",
    ]);
  });

  it("stores no skipped phases [] for a 'full' project", () => {
    expect(resolveSkippedPhasesForMode("full")).toEqual([]);
  });

  it("stores ['brief'] for a 'backend' project", () => {
    expect(resolveSkippedPhasesForMode("backend")).toEqual(["brief"]);
  });

  it("overrides the default when an explicit skippedPhases array is provided", () => {
    expect(resolveSkippedPhasesForMode("quick", ["customPhase"])).toEqual([
      "customPhase",
    ]);
    expect(resolveSkippedPhasesForMode("full", ["brief"])).toEqual(["brief"]);
    expect(resolveSkippedPhasesForMode("backend", [])).toEqual([]);
    expect(resolveSkippedPhasesForMode(undefined, ["customPhase"])).toEqual([
      "customPhase",
    ]);
  });

  it("returns undefined when no mode and no explicit skipped phases are provided", () => {
    expect(resolveSkippedPhasesForMode()).toBeUndefined();
  });
});

