import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageStepper } from "../stage-stepper";
import { buildStageReport, stageQualityFlagFor } from "@/lib/quality/stage-report";
import type { PhaseStatusMap } from "@/lib/workflow";

describe("StageStepper", () => {
  it("renders exactly three links with labels 'Requirements', 'Design', and 'Tasks', and asserts no element with text 'Skipped' is present", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "pending",
      domainModel: "skipped",
      specs: "pending",
      artifacts: "skipped",
      stories: "pending",
    };

    render(
      <StageStepper
        projectId="project-123"
        currentPhase="prd"
        phases={phases}
        skippedPhases={["domainModel", "artifacts"]}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);

    expect(screen.getByRole("link", { name: /requirements/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /design/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /tasks/i })).toBeInTheDocument();

    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument();
  });

  it("links each step to the first enabled phase in the stage that is not ready", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "pending",
      domainModel: "skipped",
      specs: "ready",
      artifacts: "pending",
      stories: "pending",
    };

    render(
      <StageStepper
        projectId="proj-456"
        currentPhase="brief"
        phases={phases}
        skippedPhases={["domainModel"]}
      />
    );

    const requirementsLink = screen.getByRole("link", { name: /requirements/i });
    expect(requirementsLink).toHaveAttribute("href", "/project/proj-456/phase/prd");

    const designLink = screen.getByRole("link", { name: /design/i });
    expect(designLink).toHaveAttribute("href", "/project/proj-456/phase/artifacts");

    const tasksLink = screen.getByRole("link", { name: /tasks/i });
    expect(tasksLink).toHaveAttribute("href", "/project/proj-456/phase/stories");
  });

  it("links to the first enabled phase when all enabled phases in the stage are ready", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "ready",
      domainModel: "skipped",
      specs: "ready",
      artifacts: "ready",
      stories: "ready",
    };

    render(
      <StageStepper
        projectId="proj-789"
        currentPhase="stories"
        phases={phases}
        skippedPhases={["domainModel"]}
      />
    );

    const requirementsLink = screen.getByRole("link", { name: /requirements/i });
    expect(requirementsLink).toHaveAttribute("href", "/project/proj-789/phase/brief");

    const designLink = screen.getByRole("link", { name: /design/i });
    expect(designLink).toHaveAttribute("href", "/project/proj-789/phase/specs");
  });

  it("highlights the step if currentPhase belongs to the stage", () => {
    render(
      <StageStepper
        projectId="proj-1"
        currentPhase="specs"
        phases={{}}
        skippedPhases={[]}
      />
    );

    const requirementsLink = screen.getByRole("link", { name: /requirements/i });
    const designLink = screen.getByRole("link", { name: /design/i });
    const tasksLink = screen.getByRole("link", { name: /tasks/i });

    expect(requirementsLink).not.toHaveAttribute("aria-current", "step");
    expect(designLink).toHaveAttribute("aria-current", "step");
    expect(tasksLink).not.toHaveAttribute("aria-current", "step");
  });

  it("does not highlight any step if currentPhase === 'constitution'", () => {
    render(
      <StageStepper
        projectId="proj-1"
        currentPhase="constitution"
        phases={{}}
        skippedPhases={[]}
      />
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).not.toHaveAttribute("aria-current", "step");
    }
  });

  it("displays stage status labels correctly", () => {
    const phases: PhaseStatusMap = {
      brief: "ready",
      prd: "ready",
      specs: "generating",
      stories: "pending",
    };

    render(
      <StageStepper
        projectId="proj-1"
        currentPhase="specs"
        phases={phases}
        skippedPhases={["domainModel", "artifacts"]}
      />
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Generating")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });
});

/**
 * The map marks a stage whose requirements are untraced or whose criteria state nothing checkable.
 * The mark is a word in the status text, never a second colour on its own, and it comes from the same
 * report the artifact shows rather than from a count of its own.
 *
 * The label and the status are separate spans in a flex column, so the link's accessible name runs
 * them together with no separator: "RequirementsReady". That is how it already named itself, and
 * these assertions are written against the name as it is actually read.
 */
describe("StageStepper quality marks", () => {
  const allReady: PhaseStatusMap = {
    brief: "ready",
    prd: "ready",
    domainModel: "ready",
    specs: "ready",
    artifacts: "ready",
    stories: "ready",
  };

  it("appends the gap to the status label, inside the link's accessible name", () => {
    render(
      <StageStepper
        projectId="proj-1"
        phases={allReady}
        quality={{
          requirements: { untraced: 1, unobservable: 0, vague: 0 },
          design: { untraced: 0, unobservable: 2, vague: 1 },
          tasks: { untraced: 0, unobservable: 0, vague: 0 },
        }}
      />
    );

    expect(
      screen.getByRole("link", { name: "RequirementsReady, 1 requirement untraced" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "DesignReady, 2 criteria not testable, 1 criterion vague" })
    ).toBeInTheDocument();
    // A stage with nothing to report keeps the bare status label.
    expect(screen.getByRole("link", { name: "TasksReady" })).toBeInTheDocument();
  });

  it("wraps the status line rather than clipping the gap, and keeps the label truncating", () => {
    render(
      <StageStepper
        projectId="proj-1"
        phases={allReady}
        quality={{ requirements: { untraced: 1, unobservable: 0, vague: 0 } }}
      />
    );

    const status = screen.getByText(/1 requirement untraced/);
    expect(status.className).not.toContain("truncate");
    expect(screen.getByText("Requirements").className).toContain("truncate");
  });

  it("adds nothing for an all-zero flag or for no flag at all", () => {
    const zeros = { untraced: 0, unobservable: 0, vague: 0 };

    const { unmount } = render(
      <StageStepper
        projectId="proj-1"
        phases={allReady}
        quality={{ requirements: zeros, design: zeros, tasks: zeros }}
      />
    );

    for (const label of ["Requirements", "Design", "Tasks"]) {
      expect(screen.getByRole("link", { name: `${label}Ready` })).toBeInTheDocument();
    }

    unmount();

    render(<StageStepper projectId="proj-1" phases={allReady} />);

    for (const label of ["Requirements", "Design", "Tasks"]) {
      expect(screen.getByRole("link", { name: `${label}Ready` })).toBeInTheDocument();
    }
  });

  it("adds nothing for a stage whose only criteria are unclassified", () => {
    // Going through the real report is the point: the flag builder has to exclude `unclassified`, and
    // a criterion written before the class existed is not relabelled untestable by the map.
    const report = buildStageReport({
      documents: [],
      claims: [],
      sectionPlan: [],
      criteria: ["A criterion from before the class existed."],
    });
    const flag = stageQualityFlagFor(report);

    expect(report.testability.unclassified).toBe(1);

    render(
      <StageStepper
        projectId="proj-1"
        phases={allReady}
        quality={{ requirements: flag, design: flag, tasks: flag }}
      />
    );

    for (const label of ["Requirements", "Design", "Tasks"]) {
      expect(screen.getByRole("link", { name: `${label}Ready` })).toBeInTheDocument();
    }
  });
});
