import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewProjectPage from "../page";

const push = vi.fn();
const createProject = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => createProject,
}));

vi.mock("@/components/prompt-enhance-button", () => ({
  PromptEnhanceButton: () => null,
}));

describe("NewProjectPage", () => {
  beforeEach(() => {
    push.mockReset();
    createProject.mockReset().mockResolvedValue("p1");
  });

  it("offers each mode by its one name and description", () => {
    render(<NewProjectPage />);

    expect(screen.getByRole("button", { name: /^Lite For a feature or a fix/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^Full For a new product/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Backend For services and APIs/ })).toBeInTheDocument();
    expect(screen.queryByText("Fast-Track")).not.toBeInTheDocument();
  });

  it("creates the project and opens its page in one step", async () => {
    render(<NewProjectPage />);

    fireEvent.click(screen.getByRole("button", { name: /^Full / }));
    fireEvent.change(screen.getByPlaceholderText(/Collaborative Canvas/), {
      target: { value: "Ledger" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the system in detail/), {
      target: { value: "A shared ledger for small teams." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/project/p1"));
    expect(createProject).toHaveBeenCalledWith({
      title: "Ledger",
      description: "A shared ledger for small teams.",
      constitutionTemplateId: undefined,
      mode: "full",
    });
    expect(screen.queryByText(/Connect Your Repository/)).not.toBeInTheDocument();
  });
});
