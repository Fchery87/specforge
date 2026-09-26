import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectRulesCard } from "../project-rules-card";

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  useQuery: () => null,
}));

describe("ProjectRulesCard", () => {
  const validBaseConstitution = {
    lockedConstraints: {
      stateInvariants: ["Invariant 1"],
      domainRules: ["Rule 1"],
      securityProtocols: ["Security 1"],
    },
    architecture: {
      pattern: "Layered",
      stateManagement: "Convex",
      apiDesign: "RPC",
      dataFlow: "Unidirectional",
      rationale: "Clean separation",
    },
    techStack: {
      frontend: { framework: "Next.js", version: "16", language: "TypeScript" },
      backend: { runtime: "Node.js", framework: "Convex", version: "latest" },
      database: { type: "Convex DB", orm: "Convex", hosting: "Convex Cloud" },
      styling: { approach: "Tailwind CSS", uiLibrary: "shadcn/ui" },
      keyDependencies: ["lucide-react"],
    },
    qualityStandards: {
      accessibility: { wcagLevel: "AA", targetCompliance: "100%", requirements: [] },
      performance: { bundleSizeLimit: "200kb", ttfbTarget: "200ms", lcpTarget: "2.5s", requirements: [] },
      security: { authentication: "Clerk", authorization: "RBAC", requirements: [] },
      testing: { unitCoverage: 80, integrationRequired: true, e2eRequired: true },
    },
    namingConventions: {
      files: { components: "kebab-case", utilities: "kebab-case", styles: "kebab-case" },
      components: "PascalCase",
      functions: "camelCase",
      variables: "camelCase",
      constants: "UPPER_SNAKE_CASE",
    },
    forbiddenPatterns: [],
    globalConstraints: {
      browserSupport: ["Modern browsers"],
      deviceCompatibility: ["Desktop", "Mobile"],
      compliance: ["GDPR"],
      deployment: { platform: "Vercel", constraints: [] },
    },
  };

  it("asserts '2 proposed rules need review' for a constitution with two proposed entries", () => {
    const constitutionWithTwoProposed = {
      ...validBaseConstitution,
      decisionRegister: [
        {
          area: "Frontend",
          decision: "Adopt Turbopack",
          status: "proposed",
          source: "brief",
          rationale: "Faster builds",
        },
        {
          area: "State",
          decision: "Use Convex client",
          status: "proposed",
          source: "brief",
          rationale: "Reactive data sync",
        },
      ],
    };

    render(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={JSON.stringify(constitutionWithTwoProposed)}
      />
    );

    expect(screen.getByText("2 proposed rules need review")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view project rules/i });
    expect(link).toHaveAttribute("href", "/project/proj-123/phase/constitution");
  });

  it("asserts no count for invalid JSON", () => {
    render(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent="invalid json {"
      />
    );

    expect(screen.queryByText(/proposed rule/i)).not.toBeInTheDocument();
    expect(screen.getByText("Project Rules")).toBeInTheDocument();
  });

  it("asserts '1 proposed rule needs review' for a single proposed rule", () => {
    const constitutionWithOneProposed = {
      ...validBaseConstitution,
      decisionRegister: [
        {
          area: "Frontend",
          decision: "Adopt Turbopack",
          status: "proposed",
          source: "brief",
          rationale: "Faster builds",
        },
      ],
    };

    render(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={JSON.stringify(constitutionWithOneProposed)}
      />
    );

    expect(screen.getByText("1 proposed rule needs review")).toBeInTheDocument();
  });

  it("counts unresolved rules as needing review", () => {
    const constitutionWithUnresolved = {
      ...validBaseConstitution,
      decisionRegister: [
        {
          area: "Auth",
          decision: "OAuth provider selection",
          status: "unresolved",
          source: "brief",
          rationale: "Pending decision",
        },
      ],
    };

    render(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={JSON.stringify(constitutionWithUnresolved)}
      />
    );

    expect(screen.getByText("1 proposed rule needs review")).toBeInTheDocument();
  });

  it("shows no count when parsing fails due to invalid schema structure", () => {
    const invalidSchemaContent = JSON.stringify({
      decisionRegister: [{ status: "proposed" }],
    });

    render(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={invalidSchemaContent}
      />
    );

    expect(screen.queryByText(/proposed rule/i)).not.toBeInTheDocument();
  });

  it("renders Draft rules button for full and backend projects with no constitution", () => {
    const { rerender } = render(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={null}
        mode="full"
      />
    );
    expect(screen.getByRole("button", { name: "Draft rules" })).toBeInTheDocument();

    rerender(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={null}
        mode="backend"
      />
    );
    expect(screen.getByRole("button", { name: "Draft rules" })).toBeInTheDocument();
  });

  it("does not render Draft rules button when constitution exists or mode is quick", () => {
    const { rerender } = render(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={JSON.stringify(validBaseConstitution)}
        mode="full"
      />
    );
    expect(screen.queryByRole("button", { name: "Draft rules" })).not.toBeInTheDocument();

    rerender(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={null}
        mode="quick"
      />
    );
    expect(screen.queryByRole("button", { name: "Draft rules" })).not.toBeInTheDocument();
  });

  it("calls onDraftRules when Draft rules button is clicked", async () => {
    const onDraftRules = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectRulesCard
        projectId="proj-123"
        constitutionContent={null}
        mode="full"
        onDraftRules={onDraftRules}
      />
    );

    const draftButton = screen.getByRole("button", { name: "Draft rules" });
    await userEvent.click(draftButton);
    expect(onDraftRules).toHaveBeenCalledTimes(1);
  });
});
