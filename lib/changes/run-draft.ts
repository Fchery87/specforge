import { buildDraftChangePrompt, REGRESSION_REMINDER, type DraftPromptInput } from './draft-prompt';
import { parseDraft, type DraftOpInput } from './parse-draft';

export interface DraftResult {
  ops: DraftOpInput[];
  notes: string[];
}

/**
 * Drafts a change with one retry: a bug fix whose first draft has no regression criterion is
 * drafted again with a reminder. If the second draft still has none, the edits are kept and the
 * reader is told to add the criterion, because applying refuses a bug fix without one.
 */
export async function runDraft(
  input: DraftPromptInput,
  complete: (prompt: string) => Promise<string>,
): Promise<DraftResult> {
  const context = {
    kind: input.kind,
    claims: input.claims,
    phasesWithDocuments: input.phasesWithDocuments,
    evidenceSourceIds: input.evidence.map((source) => source.id),
  };
  const prompt = buildDraftChangePrompt(input);
  let draft = parseDraft(await complete(prompt), context);
  if (draft.missingRegression) {
    draft = parseDraft(await complete(`${prompt}\n\n${REGRESSION_REMINDER}`), context);
  }
  const notes = draft.missingRegression
    ? [...draft.notes, 'The draft has no regression criterion. Add an acceptance criterion before applying.']
    : draft.notes;
  return { ops: draft.ops, notes };
}
