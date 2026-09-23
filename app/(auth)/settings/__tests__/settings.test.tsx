import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SettingsHubPage from "../page";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    user: {
      fullName: "Ada Lovelace",
      primaryEmailAddress: { emailAddress: "ada@example.com" },
      publicMetadata: { role: "admin" },
      id: "user_test_123",
    },
  }),
}));

vi.mock("convex/react", () => ({
  useAction: () => vi.fn().mockResolvedValue(null),
  useQuery: () => ({
    dashboardLayout: {
      showAnalytics: true,
      showActivityFeed: true,
      defaultSort: "updatedAt",
    },
    emailNotifications: {
      generationComplete: true,
      driftDetected: true,
      weeklyDigest: false,
    },
  }),
  useMutation: () => vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/hooks/useModelDirectory", () => ({
  useModelDirectory: () => ({
    providers: [
      { id: "anthropic", name: "Anthropic" },
      { id: "openai", name: "OpenAI" },
    ],
    getProviderInfo: () => ({ name: "Anthropic" }),
    getModelById: () => null,
  }),
}));

vi.mock("@/components/ModelSelector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

describe("SettingsHubPage", () => {
  it("renders page header and tabs", () => {
    render(<SettingsHubPage />);

    expect(screen.getByText("Settings & Preferences")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /ai models/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /account/i })).toBeInTheDocument();
  });
});
