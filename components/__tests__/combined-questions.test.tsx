import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CombinedQuestions, type PhaseQuestionsData } from "../combined-questions";

describe("CombinedQuestions", () => {
  const samplePhases: PhaseQuestionsData[] = [
    {
      phaseId: "brief",
      questions: [
        {
          id: "q-brief-1",
          text: "What problem does this project solve?",
          required: true,
          suggestions: ["A fast developer spec platform."],
        },
      ],
    },
    {
      phaseId: "prd",
      questions: [
        {
          id: "q-prd-1",
          text: "Who are the target personas?",
          required: true,
          answer: "Fullstack web engineers",
        },
      ],
    },
    {
      phaseId: "specs",
      questions: [
        {
          id: "q-specs-1",
          text: "What architectural patterns are required?",
          required: true,
          answer: "",
        },
      ],
    },
    {
      phaseId: "domainModel",
      questions: [
        {
          id: "q-dm-1",
          text: "Domain model entities",
          required: false,
        },
      ],
    },
  ];

  it("asserts that questions from Brief, PRD, and Architecture render under their stage headings, and that Generate all phases stays disabled while a required answer is empty", async () => {
    // In Lite mode, domainModel and artifacts are skipped
    const skippedPhases = ["domainModel", "artifacts"];

    render(
      <CombinedQuestions
        projectId="p1"
        phases={samplePhases}
        skippedPhases={skippedPhases}
        onGenerateEverything={vi.fn()}
      />
    );

    // Verify stage headings
    expect(screen.getByRole("heading", { level: 2, name: /requirements/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /design/i })).toBeInTheDocument();

    // Verify phase labels
    expect(screen.getByRole("heading", { level: 3, name: "Brief" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "PRD" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Architecture" })).toBeInTheDocument();

    // Verify questions from Brief, PRD, and Architecture
    expect(screen.getByText("What problem does this project solve?")).toBeInTheDocument();
    expect(screen.getByText("Who are the target personas?")).toBeInTheDocument();
    expect(screen.getByText("What architectural patterns are required?")).toBeInTheDocument();

    // Verify domainModel (skipped) is not rendered
    expect(screen.queryByText("Domain model entities")).not.toBeInTheDocument();

    // "q-specs-1" is required and empty -> "Generate all phases" must be disabled
    const generateBtn = screen.getByRole("button", { name: "Generate all phases" });
    expect(generateBtn).toBeDisabled();

    // Fill the empty required question
    const specsInput = screen.getByRole("textbox", { name: /What architectural patterns are required/i });
    await userEvent.type(specsInput, "Next.js App Router with Convex backend");

    // Button should now be enabled
    expect(generateBtn).toBeEnabled();
  });

  it("shows a pre-filled suggestion as Assumed until the user edits it", async () => {
    const skippedPhases = ["domainModel", "artifacts"];

    render(
      <CombinedQuestions
        projectId="p1"
        phases={samplePhases}
        skippedPhases={skippedPhases}
        onGenerateEverything={vi.fn()}
      />
    );

    // Brief has suggestions, so it pre-fills the first suggestion and shows "Assumed"
    expect(screen.getByText("Assumed")).toBeInTheDocument();

    // Find the textarea for brief question
    const briefInput = screen.getByRole("textbox", { name: /What problem does this project solve/i });
    expect(briefInput).toHaveValue("A fast developer spec platform.");

    // Edit the suggested answer
    await userEvent.type(briefInput, " Extra context.");

    // "Assumed" badge should disappear
    expect(screen.queryByText("Assumed")).not.toBeInTheDocument();
  });

  it("removes the Assumed label when the user keeps the answer", async () => {
    const skippedPhases = ["domainModel", "artifacts"];

    render(
      <CombinedQuestions
        projectId="p1"
        phases={samplePhases}
        skippedPhases={skippedPhases}
        onGenerateEverything={vi.fn()}
      />
    );

    expect(screen.getByText("Assumed")).toBeInTheDocument();
    const keepBtn = screen.getByRole("button", { name: /keep/i });
    await userEvent.click(keepBtn);

    expect(screen.queryByText("Assumed")).not.toBeInTheDocument();
  });

  it("calls onGenerateEverything when enabled and clicked", async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    const completePhases: PhaseQuestionsData[] = [
      {
        phaseId: "brief",
        questions: [
          {
            id: "q-1",
            text: "Question 1",
            required: true,
            answer: "Answer 1",
          },
        ],
      },
    ];

    render(
      <CombinedQuestions
        projectId="p1"
        phases={completePhases}
        skippedPhases={[]}
        onGenerateEverything={onGenerate}
      />
    );

    const generateBtn = screen.getByRole("button", { name: "Generate all phases" });
    expect(generateBtn).toBeEnabled();
    await userEvent.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("keeps Generate all phases off and says why when no model is connected", () => {
    render(
      <CombinedQuestions
        projectId="p1"
        phases={[{ phaseId: "brief", questions: [{ id: "q1", text: "Who is it for?", required: true, answer: "Teams" }] }]}
        onGenerateEverything={vi.fn()}
        modelReady={false}
      />
    );

    expect(screen.getByRole("button", { name: "Generate all phases" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("names the sections a question feeds under the question", () => {
    render(
      <CombinedQuestions
        projectId="p1"
        phases={[
          {
            phaseId: "brief",
            questions: [
              { id: "q1", text: "Who is it for?", answer: "Agencies", feeds: ["problem-and-objectives", "executive-summary"] },
              { id: "q2", text: "Any limits?", answer: "None", feeds: [] },
            ],
          },
        ]}
        skippedPhases={[]}
      />
    );

    expect(screen.getByText("Feeds Problem & Objectives, Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("Feeds the whole document")).toBeInTheDocument();
  });

  it("submits who wrote each answer: a pre-filled suggestion is drafted, a kept one accepted, a typed one user", async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    const phases: PhaseQuestionsData[] = [
      {
        phaseId: "brief",
        questions: [
          { id: "q-prefilled", text: "Prefilled?", suggestions: ["Suggested"] },
          { id: "q-kept", text: "Kept?", suggestions: ["Another"] },
          { id: "q-typed", text: "Typed?" },
          { id: "q-stored", text: "Stored draft?", answer: "Earlier draft", answerOrigin: "drafted" },
        ],
      },
    ];

    render(<CombinedQuestions projectId="p1" phases={phases} skippedPhases={[]} onGenerateEverything={onGenerate} />);

    const keepButtons = screen.getAllByRole("button", { name: /keep/i });
    await userEvent.click(keepButtons[1]);
    await userEvent.type(screen.getByRole("textbox", { name: /Typed\?/ }), "My answer");
    await userEvent.click(screen.getByRole("button", { name: "Generate all phases" }));

    expect(onGenerate).toHaveBeenCalledWith([
      { phaseId: "brief", questionId: "q-prefilled", answer: "Suggested", answerOrigin: "drafted" },
      { phaseId: "brief", questionId: "q-kept", answer: "Another", answerOrigin: "accepted" },
      { phaseId: "brief", questionId: "q-typed", answer: "My answer", answerOrigin: "user" },
      { phaseId: "brief", questionId: "q-stored", answer: "Earlier draft", answerOrigin: "drafted" },
    ]);
  });
});
