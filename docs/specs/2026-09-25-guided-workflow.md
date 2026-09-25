# Guided three-stage workflow

**Date:** 2026-09-25
**Plan:** [Guided workflow implementation plan](../plans/2026-09-25-guided-workflow.md)

## Problem

A SpecForge user who opens a project sees eight phases and gets no instruction about what to do next.

- The project page and the phase stepper list eight phases: Constitution, Brief, PRD, Domain Model, Spec & Architecture, Tasks/Stories, Artifacts, and Handoff + ZIP. Each phase has its own question round, generation run, and review. A Full project can ask up to about 10 clarification questions per phase, across eight rounds, before anything reaches a coding agent.
- A phase page has no "continue" action. When a phase finishes, the user goes back to the project page or reads the stepper to find the next phase.
- A phase page shows three navigation controls for the same list: breadcrumbs, `PhaseSwitcher`, and `PhaseStatusIndicator`. The project page adds `PhaseStepper` and eight `ProjectPhaseCard`s.
- A project mode hides phases by adding them to `skippedPhases` in `convex/projects.ts`. The stepper still shows them, struck through and labelled "Skipped". A Quick Feature Spec project shows three struck-through phases, so the short path looks as long as the full one.
- The word "Quick" names three things: the standalone Quick Spec page (`/dashboard/quick`), the Quick Feature Spec project mode, and the "Quick Spec history" button on the project page.
- The Backend mode card in `app/(auth)/dashboard/new/page.tsx` shows the flow as "Constitution → Domain → Specs → Artifacts → Handoff". `convex/projects.ts` skips only `brief` and `stories` for that mode, so PRD also runs. The card and the behavior disagree.
- A user with no usable model credentials learns this only when a generation action throws "No LLM credentials configured". By then they have written the brief and answered the questions. `generateSectionContent` in `convex/actions/generatePhase.ts` also returns placeholder markdown instead of throwing when it gets no client. The upstream credential check makes that path unlikely, but it can save text that is not a spec into an artifact.
- The phase list is defined in four places: `lib/phase-config.ts`, a local `PHASES` array in `app/project/[id]/page.tsx` with different descriptions, `DEFAULT_PHASES` in `convex/projects.ts`, and `lib/specification/phase-registry.ts`. Only its own test imports `phase-registry.ts`.
- Export offers six formats in `components/export-options.tsx`. Two of them copy content for a single tool: "Copy for Claude Code" for `CLAUDE.md`, and "Copy for Cursor" for `.cursorrules`. The generated `AGENTS.md` puts every constitution decision into one list. It does not separate confirmed rules from proposals.

## Goal

A user sees one workflow with three stages: Requirements, Design, and Tasks. Every page shows the next action. Every project always has Project Rules and can export at any time. The export gives coding agents one rules file, `AGENTS.md`, plus a `CLAUDE.md` that only imports it.

## Non-goals

- Merging the prompts or the stored data of the eight phases. The eight phase IDs stay in `convex/schema.ts`, in generation, in section plans, in evidence, and in the ZIP. This spec changes only the structure the user sees. A later roadmap phase merges prompts and data after users have tried the three-stage structure.
- Running Design before Requirements for Backend projects. Generation reads upstream phases in their current order. Design-first needs prompt changes, so it moves to the later phase.
- Regenerating only the stages that an edit affects.
- Requirement readiness scoring, acceptance-criteria formats, and document length budgets.
- Change specs, bug-fix specs, pull-request verification, and an MCP server. `docs/roadmap.md` lists these as later phases.
- A redesign of the landing page, the dashboard layout, or the admin console.
- Removing `SKILL.md` from the export. `SKILL.md` is a build guide, not a rules file, and the export keeps it.

## Approach

### Data shape

One module, `lib/workflow.ts`, owns the workflow. It holds only data and pure functions and imports no UI code, so `convex/` can import it the same way it imports `lib/export`.

```ts
export type PhaseId =
	| 'constitution' | 'brief' | 'prd' | 'domainModel'
	| 'specs' | 'stories' | 'artifacts' | 'handoff';

export type StageId = 'requirements' | 'design' | 'tasks';

export interface WorkflowStage {
	id: StageId;
	label: string;              // "Requirements"
	summary: string;            // "What to build and why"
	phaseIds: readonly PhaseId[];
}

export const PHASE_ORDER: readonly PhaseId[];      // the eight IDs, in generation order
export const WORKFLOW_STAGES: readonly WorkflowStage[];
export const RULES_PHASE: PhaseId = 'constitution';
export const EXPORT_PHASE: PhaseId = 'handoff';

export type ProjectMode = 'quick' | 'full' | 'backend';

export interface ModePolicy {
	label: string;                        // "Lite", "Full", "Backend"
	reviewAfter: readonly StageId[];      // stages that stop for review
	skippedPhases: readonly PhaseId[];    // defaults for new projects
}

export const MODE_POLICIES: Record<ProjectMode, ModePolicy>;

export type StageStatus = 'not-started' | 'in-progress' | 'generating' | 'ready' | 'error';

export function stageStatus(stage: WorkflowStage, phases: PhaseStatusMap, skipped: readonly PhaseId[]): StageStatus;
export function nextAction(phases: PhaseStatusMap, skipped: readonly PhaseId[], mode: ProjectMode): NextAction;
```

Each stage groups the existing phases like this.

| Stage or place | Phases | Shown as |
| --- | --- | --- |
| Requirements | `brief`, `prd` | Stage 1, with sub-tabs Brief and PRD |
| Design | `domainModel`, `specs`, `artifacts` | Stage 2, with sub-tabs Domain Model, Architecture, and Schemas |
| Tasks | `stories` | Stage 3 |
| Project Rules | `constitution` | A panel on the project page and a header button. It is never a numbered step. |
| Export | `handoff` | A header button, available at every stage |

Each mode sets a review policy and default skipped phases for new projects.

| Mode ID | Label | Stops for review after | Default skipped phases |
| --- | --- | --- | --- |
| `quick` | Lite | Nothing. The user answers one combined question round, then every stage generates. | `domainModel`, `artifacts` |
| `full` | Full | Requirements, Design, and Tasks | None |
| `backend` | Backend | Requirements, Design, and Tasks | `brief` |

The mode IDs stay the same, so existing projects need no data migration. Only the labels change. No mode skips `constitution` any more, because every project has Project Rules. No mode skips `stories`, because every project has Tasks. A Lite project still generates Design, from the `specs` phase only.

`PhaseStatusMap` is the existing phase status record from `api.projects.getProjectPhases`. `nextAction` returns one of these: answer the questions for a phase, generate a phase, review a stage, continue to the next stage, or export. Every page reads its primary button from `nextAction`, so no component decides the order on its own.

### Flow

1. **Create.** The new-project page shows three mode cards with the labels and flows from `MODE_POLICIES`. The page reads a new `getGenerationReadiness` query first. If the user has no usable credentials, the page shows a banner that links to the model settings. The user can still write the brief.
2. **Project page.** The page shows three stage cards, a Project Rules card, and an Export button. Each stage card shows the stage status and one button taken from `nextAction`. Skipped phases do not appear. Each stage lists its skipped phases under "Add a section", where the existing `toggleSkipPhase` mutation turns them back on.
3. **Stage workspace.** The route stays `/project/[id]/phase/[phaseId]`. The page shows one `StageStepper` with three steps, a sub-tab row for the phases in the current stage, and a primary button from `nextAction`, such as "Continue to Design". The page drops `PhaseSwitcher` and `PhaseStatusIndicator`.
4. **Lite projects.** After creation, a Lite project opens a combined question page. It lists the required questions from every enabled phase, with AI-suggested answers from the existing `generateAllQuestionAnswers` action already filled in. One button saves the answers and calls the existing `generateAllPhases` action.
5. **Full and Backend projects.** Each stage stops for review. The Continue button is the review action. Nothing starts the next stage without it.
6. **Project Rules.** The panel shows the constitution. A badge counts the decisions whose `status` is `proposed` or `unresolved` in the constitution `decisionRegister`. For a Full or Backend project that has no constitution yet, the panel offers "Draft rules". That button fills the constitution questions from `generateAllQuestionAnswers` and generates the phase. Missing rules never block another stage.
7. **Export.** The header Export button opens the existing export options at every stage. The export builds from the artifacts that exist. If the `handoff` artifact is missing, the dialog offers to generate it and does not require it.
8. **Dashboard.** Each project card links to the stage from `nextAction`, labelled "Resume at Design" or similar. It does not always link to the project page.

### Exported rules

`AGENTS.md` is the only file that holds exported rules. The ZIP adds a `CLAUDE.md` that contains only this line.

```markdown
@AGENTS.md
```

Claude Code reads `CLAUDE.md` and does not read `AGENTS.md` natively, per the Claude Code memory docs at `code.claude.com/docs/en/memory`. Those docs recommend this import line. Cursor reads `AGENTS.md` in the project root and in subdirectories, per `cursor.com/docs/rules`, so the export generates no `.cursor/rules` and no `.cursorrules`. The export uses the import line, not a symlink, because ZIP archives and Windows do not keep symlinks reliably.

`generateAgentsMd` groups the constitution `decisionRegister` by status. "Rules" lists `confirmed` decisions. "Observed in the repository" lists `observed` decisions. "Proposed, not confirmed" lists `proposed` decisions. "Open questions" lists `unresolved` decisions and `openQuestions`. An agent that reads the file can tell a rule from a proposal.

### Naming

| Today | After |
| --- | --- |
| Quick Feature Spec (mode) | Lite |
| Full System Blueprint (mode) | Full |
| API & Backend Service (mode) | Backend |
| Quick Spec history (project button) | Saved quick specs |
| Constitution (phase) | Project Rules |
| Handoff + ZIP (phase) | Export |
| Spec & Architecture (phase) | Architecture, a tab inside Design |
| Artifacts (phase) | Schemas, a tab inside Design |

The standalone page at `/dashboard/quick` keeps the name Quick Spec. It is now the only thing called "Quick".

### Credentials

`getGenerationReadiness` returns `{ ready: boolean, reason?: 'no-credentials' }`. It reads the same user config, system credentials, and enabled models that `resolveCredentials` reads in `convex/actions/generatePhase.ts`. It checks only that a usable credential exists and does not decrypt keys. `generateSectionContent` throws when it gets no client, so an artifact never stores placeholder text.

### Decision basis

These decisions come from the market review done on 2026-09-25.

- Kiro uses three documents (requirements, design, and tasks). Its Quick Plan mode generates all three with no approval stops and still keeps every document. Sources are `kiro.dev/docs/specs/` (updated 2026-08-27) and the Kiro blog post "Specs just got faster (and smarter)" from 2026-05-12.
- Traycer lets the user pick how much planning a task needs (Plan, Phases, or Epic). Source is `docs.traycer.ai/extension/tasks`.
- `AGENTS.md` support comes from the Claude Code and Cursor docs cited above. The open Claude Code feature request `anthropics/claude-code#34235` confirms that Claude Code does not read `AGENTS.md` natively.

## Alternatives considered

- **Merge the eight phases into three in the data and the prompts now.** This change needs a migration of `phases`, `artifacts`, section plans, and evidence claims keyed by phase ID. The three-stage structure is not yet tested with users, so the change costs too much to undo. The later phase does it.
- **Keep eight phases and fix only the navigation.** The "Continue" button and the single stepper help. The user still gets eight review points and three struck-through phases in Lite, which is the main complaint.
- **New `/project/[id]/stage/[stageId]` routes.** New routes need redirects from every existing phase URL and every stored link. They add no user-visible benefit over sub-tabs on the existing route.
- **Let Lite skip Design.** Tasks without interfaces, files, and test seams leave an agent guessing. Tasks also lose the context that verification checks against. A short Design costs less than a missing one.
- **Generate `.cursor/rules` and a full `CLAUDE.md` copy.** Cursor reads `AGENTS.md` natively. A full copy of the rules in `CLAUDE.md` drifts from `AGENTS.md`.
- **A symlink from `CLAUDE.md` to `AGENTS.md`.** ZIP extraction and Windows do not keep symlinks reliably.

## Deletion inventory

- `lib/specification/phase-registry.ts` and `lib/specification/__tests__/phase-registry.test.ts`. Only the test imports the module.
- The local `PHASES` array in `app/project/[id]/page.tsx`. `lib/workflow.ts` replaces it.
- The `DEFAULT_PHASES` array in `convex/projects.ts`. `PHASE_ORDER` replaces it.
- The mode-to-skipped-phases ternary in `createProject` in `convex/projects.ts`. `MODE_POLICIES` replaces it.
- The local `PROJECT_MODES` array in `app/(auth)/dashboard/new/page.tsx`. `MODE_POLICIES` replaces its labels and flow summaries. The icons stay in the page.
- `components/phase-switcher.tsx` and `components/__tests__/phase-switcher.test.tsx`.
- `components/phase-status.tsx`. Its only caller is the phase page.
- `components/phase-stepper.tsx` and its test. `StageStepper` replaces them.
- The eight `ProjectPhaseCard` instances on the project page. Three stage cards replace them. The file `components/project-phase-card.tsx` is deleted if no caller remains.
- The "Copy for Claude Code" and "Copy for Cursor" export options in `components/export-options.tsx`, and `formatForClaudeCode`, `formatForCursor`, and `formatForCopilot` in `lib/export/clipboard-formats.ts`. The file is deleted if nothing else remains in it.
- The placeholder-markdown branches in `generateSectionContent` in `convex/actions/generatePhase.ts` (two occurrences, near lines 537 and 752 on 2026-09-25).
- The `/settings/llm-config` redirect page stays. Old links still reach settings through it.

## Verification

- `npm run typecheck`, `npm run lint`, and `npm run test -- --run --reporter=dot --testTimeout=20000` exit zero.
- `lib/workflow.test.ts` asserts the literal stage grouping, the mode policies, and `nextAction` for each mode at each status combination listed in the plan.
- An authenticated Playwright suite under `e2e/` creates a Lite project and a Full project. It checks that the stepper shows exactly three steps and that no "Skipped" label appears. It follows the Continue button from Requirements to Tasks and opens Export from the Requirements stage.
- An exported ZIP from a project with a constitution contains `AGENTS.md` and a `CLAUDE.md` whose whole content is `@AGENTS.md`. It contains no `.cursor/` directory. `unzip -l` and `unzip -p <zip> CLAUDE.md` show both facts.
- In a Claude Code session opened in the extracted folder, `/context` lists `CLAUDE.md` and the imported `AGENTS.md` content.
- An account with no user credentials, on a deployment with no system credentials, sees the credentials banner on `/dashboard/new` before it writes the brief.

## Risks

- **Users who learned the eight phases lose their bearings.** The sub-tabs keep every phase name visible inside its stage, and phase URLs do not change. Watch support questions that mention a missing phase.
- **Lite quality drops without review stops.** The combined question round still shows every required question. Compare Lite and Full output on the same brief during rollout.
- **Auto-filled answers read as confirmed.** AI-suggested answers in the combined round must stay labelled as suggestions until the user edits or accepts them. The existing question UI already marks suggestions. The combined page must keep that label.
- **The readiness query and `resolveCredentials` disagree.** If they drift, the banner says ready and generation still throws. Both read the credential lookup from one function, and a unit test covers both callers.
- **Backend projects lose `stories` skipping.** Backend projects created before this change keep their stored `skippedPhases`. Only new projects get the new defaults.
- **The `CLAUDE.md` import line stops working if Claude Code changes its memory loading.** The export test checks the file content, and the docs link in this spec gives the source to recheck.
