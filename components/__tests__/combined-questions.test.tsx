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

  it("asserts that questions from Brief, PRD, and Architecture render under their stage headings, and that Generate everything stays disabled while a required answer is empty", async () => {
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

    // "q-specs-1" is required and empty -> "Generate everything" must be disabled
    const generateBtn = screen.getByRole("button", { name: "Generate everything" });
    expect(generateBtn).toBeDisabled();

    // Fill the empty required question
    const specsInput = screen.getByRole("textbox", { name: /What architectural patterns are required/i });
    await userEvent.type(specsInput, "Next.js App Router with Convex backend");

    // Button should now be enabled
    expect(generateBtn).toBeEnabled();
  });

  it("asserts that a suggested answer shows the label Suggestion until the user edits it", async () => {
    const skippedPhases = ["domainModel", "artifacts"];

    render(
      <CombinedQuestions
        projectId="p1"
        phases={samplePhases}
        skippedPhases={skippedPhases}
        onGenerateEverything={vi.fn()}
      />
    );

    // Brief has suggestions, so it pre-fills the first suggestion and shows "Suggestion"
    expect(screen.getByText("Suggestion")).toBeInTheDocument();

    // Find the textarea for brief question
    const briefInput = screen.getByRole("textbox", { name: /What problem does this project solve/i });
    expect(briefInput).toHaveValue("A fast developer spec platform.");

    // Edit the suggested answer
    await userEvent.type(briefInput, " Extra context.");

    // "Suggestion" badge should disappear
    expect(screen.queryByText("Suggestion")).not.toBeInTheDocument();
  });

  it("removes Suggestion label when user accepts the suggestion", async () => {
    const skippedPhases = ["domainModel", "artifacts"];

    render(
      <CombinedQuestions
        projectId="p1"
        phases={samplePhases}
        skippedPhases={skippedPhases}
        onGenerateEverything={vi.fn()}
      />
    );

    expect(screen.getByText("Suggestion")).toBeInTheDocument();
    const acceptBtn = screen.getByRole("button", { name: /accept/i });
    await userEvent.click(acceptBtn);

    expect(screen.queryByText("Suggestion")).not.toBeInTheDocument();
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

    const generateBtn = screen.getByRole("button", { name: "Generate everything" });
    expect(generateBtn).toBeEnabled();
    await userEvent.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
