import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { StressTestModal } from "../stress-test-modal";

const mockGenerateGrillRound = vi.fn();
const mockSaveGrillAnswers = vi.fn();
const mockResetGrillSession = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockGenerateGrillRound,
  useMutation: (action: unknown) => {
    // Provide appropriate mock
    return (args: unknown) => {
      if (typeof action === "object") {
        return mockSaveGrillAnswers(args);
      }
      return mockSaveGrillAnswers(args);
    };
  },
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

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("StressTestModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateGrillRound.mockResolvedValue({
      questions: [
        {
          id: "specs-grill-r1-q1",
          text: "What is the retry policy for webhook delivery?",
          recommendedAnswer: "Exponential backoff with jitter up to 5 attempts.",
          suggestions: ["Exponential backoff", "Linear 3 retries", "No retries"],
          grillRound: 1,
        },
      ],
      currentRound: 1,
      totalQuestionsAsked: 0,
      reachedLimit: false,
    });
  });

  test("renders modal header and question when open", async () => {
    render(
      <StressTestModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj1"
        phaseId="specs"
      />
    );

    expect(screen.getByText("Stress-Test Plan")).toBeInTheDocument();
    expect(screen.getByText("0 / 10 Max Questions")).toBeInTheDocument();

    await waitFor(() => {
      const questionEl = screen.getByTestId("grill-question-text");
      expect(questionEl.textContent).toContain(
        "What is the retry policy for webhook delivery?"
      );
      expect(
        screen.getByText("Accept")
      ).toBeInTheDocument();
      expect(
        screen.getAllByText(/Exponential backoff with jitter up to 5 attempts/).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  test("clicking accept recommendation populates textarea", async () => {
    render(
      <StressTestModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj1"
        phaseId="specs"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Accept")).toBeInTheDocument();
    });

    const acceptBtn = screen.getByText("Accept");
    fireEvent.click(acceptBtn);

    const textarea = screen.getByPlaceholderText(
      "Write your decision or edit the recommendation..."
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe(
      "Exponential backoff with jitter up to 5 attempts."
    );
  });

  test("clicking a suggestion option chip updates textarea", async () => {
    render(
      <StressTestModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj1"
        phaseId="specs"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Linear 3 retries")).toBeInTheDocument();
    });

    const optionBtn = screen.getByText("Linear 3 retries");
    fireEvent.click(optionBtn);

    const textarea = screen.getByPlaceholderText(
      "Write your decision or edit the recommendation..."
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("Linear 3 retries");
  });

  test("displays capped state when totalQuestionsAsked is 10", () => {
    render(
      <StressTestModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj1"
        phaseId="specs"
        grillSession={{
          totalQuestionsAsked: 10,
          currentRound: 4,
          isComplete: true,
          rounds: [
            {
              roundNumber: 1,
              questions: [
                {
                  id: "q1",
                  text: "Q1",
                  recommendedAnswer: "A1",
                  userAnswer: "A1",
                  acceptedRecommendation: true,
                },
              ],
            },
          ],
        }}
      />
    );

    expect(
      screen.getByText("Stress-Test Limit Reached (10 / 10)")
    ).toBeInTheDocument();
    expect(screen.getByText("10 / 10 Max Questions")).toBeInTheDocument();
    expect(screen.getByText("1. Q1")).toBeInTheDocument();
  });

  test("a question with no recommendation shows its options and no accept control, and starts blank", async () => {
    mockGenerateGrillRound.mockResolvedValue({
      questions: [
        {
          id: "q_abc",
          text: "How are tenants isolated?",
          suggestions: ["Row-level security", "Database per tenant"],
          feeds: ["deep-modules"],
        },
      ],
      currentRound: 1,
      totalQuestionsAsked: 0,
      reachedLimit: false,
    });

    render(
      <StressTestModal open={true} onOpenChange={vi.fn()} projectId="proj1" phaseId="specs" />
    );

    await waitFor(() => {
      expect(screen.getByText("Row-level security")).toBeInTheDocument();
    });
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
    expect(screen.queryByText(/Standard/)).not.toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(
      "Write your decision or edit the recommendation..."
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  test("saves what was answered, marks an untouched recommendation as accepted and a typed answer as not", async () => {
    mockGenerateGrillRound.mockResolvedValue({
      questions: [
        {
          id: "q_one",
          text: "Retry policy?",
          recommendedAnswer: "Exponential backoff.",
          feeds: ["deep-modules"],
        },
        { id: "q_two", text: "Tenant isolation?", suggestions: ["RLS", "Database per tenant"] },
        { id: "q_three", text: "Retention?", recommendedAnswer: "One year.", feeds: [] },
      ],
      currentRound: 1,
      totalQuestionsAsked: 0,
      reachedLimit: false,
    });
    mockSaveGrillAnswers.mockResolvedValue(undefined);

    render(
      <StressTestModal open={true} onOpenChange={vi.fn()} projectId="proj1" phaseId="specs" />
    );
    await waitFor(() => expect(screen.getAllByTestId("grill-question-text")).toHaveLength(3));

    const boxes = screen.getAllByPlaceholderText(
      "Write your decision or edit the recommendation..."
    );
    fireEvent.change(boxes[2], { target: { value: "Two years." } });
    fireEvent.click(screen.getByText("Save Answers"));

    await waitFor(() => expect(mockSaveGrillAnswers).toHaveBeenCalledTimes(1));
    const saved = mockSaveGrillAnswers.mock.calls[0][0].answers;
    expect(saved).toEqual([
      {
        questionId: "q_one",
        questionText: "Retry policy?",
        answer: "Exponential backoff.",
        recommendedAnswer: "Exponential backoff.",
        acceptedRecommendation: true,
        feeds: ["deep-modules"],
        options: undefined,
        round: 1,
      },
      {
        questionId: "q_three",
        questionText: "Retention?",
        answer: "Two years.",
        recommendedAnswer: "One year.",
        acceptedRecommendation: false,
        feeds: [],
        options: undefined,
        round: 1,
      },
    ]);
  });
});
