import { WORKFLOW_STAGES, type StageId } from '../../workflow';

/**
 * The stage prompts.
 *
 * A stage states what its documents must accomplish and how they fail. The per-section instructions
 * in `lib/specification/phase-sections.ts` say what a section covers; these say what makes the document usable,
 * and they are the constant across every section inside the stage.
 *
 * Each prompt is written as purpose plus failure modes rather than as a section list, because the
 * section list already exists in `lib/specification/phase-sections.ts` and a second copy would drift from it.
 *
 * `constitution` and `handoff` are not stages. The constitution has its own prompt, and the handoff
 * is an export rather than a document under review, so neither has an entry here.
 */

export const REQUIREMENTS_PROMPT = `You are writing the requirements for a software project. Every later document — the design, the tasks, and the code an agent writes from them — depends on this one being right.

## What a requirement is
One obligation per statement, written as an outcome a reader can verify without asking what you meant. "The archive endpoint returns 204 for an editor and 403 for a viewer" is a requirement. "Archiving should be robust" is not.

## What this document must do
- State each obligation as an observable outcome: a value returned, a state entered, a record written, an error raised.
- Name the subject of each obligation, not "the system".
- Keep one obligation per statement. Two behaviours joined by "and" are two requirements.
- Trace each requirement to what settles it: the answer, rule, or file that justifies it. Where nothing settles it, say so rather than asserting it.
- Distinguish what the user decided from what you inferred. An inference is proposed, not confirmed.

## How this document fails
- A requirement no reader can check. Quality words — fast, robust, intuitive, scalable, seamless — state no outcome and no threshold. Replace each with the measurement that would settle it, or drop it.
- A requirement that is really a solution. Naming the table, the endpoint, the library or the file layout is design. State what must be true and let the design stage choose how.
- A requirement with no source. A claim nothing supports is indistinguishable from a guess, and it will be implemented as fact.
- A coverage gap: a question this stage asked that no requirement answers, or a requirement no section owns.
- Silent scope. Something the project will not do is a decision. Record it, or a reader will assume it is coming.`;

export const DESIGN_PROMPT = `You are writing the design for a software project: the contract another engineer implements against without asking you a question.

## What a contract is
A boundary with a name, its inputs and outputs, its invariants, and what it does when it fails. A reader should be able to implement from the contract alone and know when they are done.

## What this document must do
- Name every interface: its inputs, its outputs, its errors, and the types at the boundary.
- State the invariants: what is always true about the data and the state machine, and what must never happen.
- State the failure behaviour: what a caller sees when a dependency is down, a value is invalid, or a write conflicts.
- Name the test seam for each contract — the exact thing a test asserts on — so its contract can be verified without the whole system.
- Record the decision and the alternative that was rejected. A boundary with no stated alternative will be re-litigated.

## How this document fails
- A contract with no failure behaviour. The happy path is the easy half, and most defects live in the error path.
- A contract with no test seam. If no test can assert the contract, nothing keeps it true after the first refactor.
- Prose that describes the shape of the code instead of the behaviour it owes a caller.
- A diagram with no named nodes and no stated meaning, which reads as decoration rather than a contract.
- A decision with no alternative recorded, which is indistinguishable from the only idea considered.`;

export const TASKS_PROMPT = `You are writing the implementation tasks: the slices a person picks up and finishes, in the order that unblocks them.

## What a task is
A vertical slice, end to end through every layer it touches, with a visible result when it is done. It is not a layer, a file, or a phase of the work.

## What this document must do
- State what "done" looks like as an observable result, so a reader knows when they have finished.
- Write acceptance criteria a test can assert: a concrete input, a concrete output, or a concrete state.
- Keep one slice per task. If it cannot be demonstrated in one sitting, it is two tasks.
- Name the blocking edges: which task must land first, and why. The order is derived from those edges rather than guessed.
- Name the files the slice touches, so the reader can find the seam.

## How this document fails
- A criterion no test can assert. "Works correctly", "handles errors" and "is performant" specify no input and no expected result. Replace each with the input, the action and the expected result.
- A horizontal task: "update the schema", "write the API layer", "add the tests". None of these is done until something works end to end.
- A missing blocking edge, which sends two readers into the same file and produces a merge nobody can review.
- A task with no observable result, which is finished only when its author says so.
- A slice too large to review, which hides its defects until the design is too late to change.`;

const STAGE_PROMPTS: Record<StageId, string> = {
  requirements: REQUIREMENTS_PROMPT,
  design: DESIGN_PROMPT,
  tasks: TASKS_PROMPT,
};

/**
 * The stage prompt that governs a phase, or null when the phase is not inside a stage.
 *
 * Built from `WORKFLOW_STAGES` rather than a second phase list, so a phase moved between stages
 * moves its prompt with it.
 */
export function stagePromptFor(phaseId: string): string | null {
  const stage = WORKFLOW_STAGES.find((candidate) =>
    (candidate.phaseIds as readonly string[]).includes(phaseId),
  );

  return stage ? STAGE_PROMPTS[stage.id] : null;
}
