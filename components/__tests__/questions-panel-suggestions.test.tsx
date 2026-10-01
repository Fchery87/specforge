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

describe("QuestionsPanel feeds and assumed answers", () => {
  const drafted = {
    ...baseQuestion,
    id: "q_drafted",
    text: "What is the retention period?",
    answer: "One year",
    answerOrigin: "drafted" as const,
    feeds: ["problem-and-objectives"],
  };

  test("names the sections a question feeds under it", () => {
    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[drafted, { ...baseQuestion, id: "q_open", text: "Any limits?", feeds: [] }]}
      />
    );
    expect(screen.getByText("Feeds Problem & Objectives")).toBeInTheDocument();
    expect(screen.getByText("Feeds the whole document")).toBeInTheDocument();
  });

  test("marks a drafted answer as assumed, and Keep saves it as accepted", async () => {
    mockSaveAnswer.mockClear();
    render(<QuestionsPanel projectId="proj1" phaseId="brief" questions={[drafted]} />);

    expect(screen.getByText(/Assumed\. The assistant wrote this/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Keep/i }));
    });

    expect(screen.queryByText(/Assumed\. The assistant wrote this/)).not.toBeInTheDocument();
    expect(mockSaveAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: "q_drafted",
        answer: "One year",
        answerOrigin: "accepted",
      }),
    );
  });

  test("editing a drafted answer clears the assumed marker", async () => {
    render(<QuestionsPanel projectId="proj1" phaseId="brief" questions={[drafted]} />);

    const textarea = screen.getByPlaceholderText("Enter your answer...");
    await act(async () => {
      fireEvent.change(textarea, { target: { value: "Two years" } });
    });

    expect(screen.queryByText(/Assumed\. The assistant wrote this/)).not.toBeInTheDocument();
  });

  test("shows no assumed marker on an answer the user gave", () => {
    render(
      <QuestionsPanel
        projectId="proj1"
        phaseId="brief"
        questions={[{ ...drafted, answerOrigin: "user" as const }]}
      />
    );
    expect(screen.queryByText(/Assumed\./)).not.toBeInTheDocument();
  });
});
