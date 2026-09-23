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
});
