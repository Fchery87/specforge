import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { QuestionsPanel } from "../questions-panel";

const mockSaveAnswer = vi.fn();
const mockGenerateQuestionAnswer = vi.fn().mockResolvedValue({
  suggestedAnswer: "Test answer",
  suggestions: ["Option A", "Option B"],
});

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useMutation: () => mockSaveAnswer,
  useAction: () => mockGenerateQuestionAnswer,
  useQuery: () => null,
}));

vi.mock("@/convex/_generated/api", () => {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") return undefined;
      return new Proxy({}, handler);
    },
  };
  return { api: new Proxy({}, handler) };
});

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

  test("clicking a chip marks it active and preserves option chips", () => {
    const question = { ...baseQuestion, suggestions: ["Option A", "Option B"] };
    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[question]}
      />
    );
    const chipA = screen.getByRole("button", { name: "Option A" });
    fireEvent.click(chipA);

    expect(chipA).toHaveAttribute("aria-pressed", "true");
    const chipB = screen.getByRole("button", { name: "Option B" });
    expect(chipB).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(chipB);
    const textarea = screen.getByPlaceholderText("Enter your answer...");
    expect((textarea as HTMLTextAreaElement).value).toBe("Option B");
    expect(chipB).toHaveAttribute("aria-pressed", "true");
    expect(chipA).toHaveAttribute("aria-pressed", "false");
  });

  test("no chips rendered when suggestions array is empty", () => {
    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[baseQuestion]}
      />
    );
    expect(screen.getByPlaceholderText("Enter your answer...")).toBeInTheDocument();
    const allButtons = screen.getAllByRole("button");
    expect(allButtons.every(btn => !["Monolith", "Microservices", "Option A", "Option B"].includes(btn.textContent ?? ""))).toBe(true);
  });

  test("ai suggest stages recommendation with accept and dismiss controls", async () => {
    mockGenerateQuestionAnswer.mockResolvedValueOnce({
      suggestedAnswer: "Microservices with gRPC",
      suggestions: ["Option A", "Option B"],
    });

    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[baseQuestion]}
      />
    );

    const suggestButton = screen.getByRole("button", { name: /Get AI suggestion for question 1/i });
    await act(async () => {
      fireEvent.click(suggestButton);
    });

    expect(await screen.findByText("Suggested answer")).toBeInTheDocument();
    expect(screen.getByText("Microservices with gRPC")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText("Enter your answer...");
    expect((textarea as HTMLTextAreaElement).value).toBe("");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Accept/i }));
    });
    expect((textarea as HTMLTextAreaElement).value).toBe("Microservices with gRPC");
    expect(screen.queryByText("Suggested answer")).not.toBeInTheDocument();
  });

  test("dismissing staged ai recommendation does not modify textarea", async () => {
    mockGenerateQuestionAnswer.mockResolvedValueOnce({
      suggestedAnswer: "Serverless lambda",
    });

    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[baseQuestion]}
      />
    );

    const suggestButton = screen.getByRole("button", { name: /Get AI suggestion for question 1/i });
    await act(async () => {
      fireEvent.click(suggestButton);
    });

    expect(await screen.findByText("Suggested answer")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    });

    expect(screen.queryByText("Suggested answer")).not.toBeInTheDocument();
    const textarea = screen.getByPlaceholderText("Enter your answer...");
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });
});
