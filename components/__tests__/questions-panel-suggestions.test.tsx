import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { QuestionsPanel } from "../questions-panel";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useAction: () => vi.fn().mockResolvedValue({ suggestedAnswer: "Test answer", suggestions: ["Option A", "Option B"] }),
  useQuery: () => null,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    projects: { saveAnswer: "saveAnswer", getGenerationTask: "getGenerationTask" },
    "actions/generateQuestions": { generateQuestions: "generateQuestions" },
    "actions/generateQuestionAnswer": { generateQuestionAnswer: "generateQuestionAnswer" },
    "actions/generateAllQuestionAnswers": { generateAllQuestionAnswers: "generateAllQuestionAnswers" },
  },
}));

vi.mock("sonner", () => ({ toast: { message: vi.fn(() => "toast-id"), success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/notifications", () => ({ getToastMessage: () => ({ title: "t", description: "d" }) }));
vi.mock("@/lib/batch-answers", () => ({ collectBatchAnswers: () => [] }));

const baseQuestion = {
  id: "q1",
  text: "What architecture pattern?",
  aiGenerated: false,
  required: false,
};

describe("QuestionsPanel suggestion chips", () => {
  test("renders suggestion chips from question prop", () => {
    const question = { ...baseQuestion, suggestions: ["Monolith", "Microservices", "Serverless"] };
    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[question]}
      />
    );
    expect(screen.getByText("Monolith")).toBeInTheDocument();
    expect(screen.getByText("Microservices")).toBeInTheDocument();
    expect(screen.getByText("Serverless")).toBeInTheDocument();
  });

  test("clicking a chip fills the textarea", () => {
    const question = { ...baseQuestion, suggestions: ["Option A", "Option B"] };
    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[question]}
      />
    );
    fireEvent.click(screen.getByText("Option A"));
    const textarea = screen.getByPlaceholderText("Enter your answer...");
    expect((textarea as HTMLTextAreaElement).value).toBe("Option A");
  });

  test("clicking a chip hides the chip row", () => {
    const question = { ...baseQuestion, suggestions: ["Option A"] };
    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[question]}
      />
    );
    fireEvent.click(screen.getByText("Option A"));
    // After clicking, the chip button should no longer be in the document
    // (the text moves into the textarea value, but no chip button remains)
    expect(screen.queryByRole("button", { name: "Option A" })).not.toBeInTheDocument();
  });

  test("no chips rendered when suggestions array is empty", () => {
    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[baseQuestion]}
      />
    );
    // Textarea renders normally
    expect(screen.getByPlaceholderText("Enter your answer...")).toBeInTheDocument();
    // No chips (there are no suggestions on this question)
    // The only buttons should be the standard UI buttons (AI suggest, batch, regenerate)
    // None should have suggestion text
    const allButtons = screen.getAllByRole("button");
    expect(allButtons.every(btn => !["Monolith", "Microservices", "Option A", "Option B"].includes(btn.textContent ?? ""))).toBe(true);
  });
});
