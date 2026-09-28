import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import QuickSpecPage from "../page";

const push = vi.fn();
const generateQuickSpec = vi.fn();
const createProjectFromQuickSpec = vi.fn();
const createChange = vi.fn();
let readiness: { ready: boolean } | undefined;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("convex/react", () => ({
  useAction: () => generateQuickSpec,
  useQuery: (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name === "projects:getProjects") return [];
    if (name === "userConfigs:getGenerationReadiness") return readiness;
    return undefined;
  },
  useMutation: (ref: FunctionReference<"mutation">) =>
    getFunctionName(ref) === "projects:createProjectFromQuickSpec" ? createProjectFromQuickSpec : createChange,
}));

vi.mock("@/components/ui/mermaid-aware-content", () => ({
  MermaidAwareContent: ({ markdown }: { markdown: string }) => <pre>{markdown}</pre>,
}));

function fillIn() {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Session refresh" } });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Refresh expired sessions without a sign-out." },
  });
}

describe("QuickSpecPage", () => {
  beforeEach(() => {
    readiness = { ready: true };
    push.mockReset();
    generateQuickSpec.mockReset().mockResolvedValue({ content: "# Session refresh" });
    createProjectFromQuickSpec.mockReset().mockResolvedValue("p9");
  });

  it("starts a project from the generated spec and opens it", async () => {
    render(<QuickSpecPage />);
    fillIn();
    fireEvent.click(screen.getByRole("button", { name: "Generate spec" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start a project from this" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/project/p9"));
    expect(createProjectFromQuickSpec).toHaveBeenCalledWith({
      title: "Session refresh",
      description: "Refresh expired sessions without a sign-out.",
      content: "# Session refresh",
    });
  });

  it("keeps Generate off and says why when no model is connected", () => {
    readiness = { ready: false };
    render(<QuickSpecPage />);
    fillIn();

    expect(screen.getByRole("button", { name: "Generate spec" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Connect a model to generate specs");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("offers to start a change in an existing project once a project is chosen", async () => {
    render(<QuickSpecPage />);
    fillIn();
    fireEvent.click(screen.getByRole("button", { name: "Generate spec" }));

    expect(await screen.findByRole("button", { name: "Start change" })).toBeDisabled();
    expect(screen.getByText("Or start a change in")).toBeInTheDocument();
  });
});

