import { z } from 'zod';
import { parseJsonReply } from '../llm/json-reply';
import {
  severityFor,
  type DecisionStatus,
  type DiffQuote,
  type OtherFinding,
  type RequirementVerdict,
  type ScopeReason,
  type Verdict,
} from './check';
import { readPatch, type DiffFile, type PatchLine } from './diff';
import type { ScopedRequirement } from './scope';

export interface ParseCheckContext {
  /** Requirements the pull request cites; when empty, the model chose from `candidates`. */
  scope: readonly ScopedRequirement[];
  candidates: ReadonlyArray<{ claimId: string; decisionStatus: DecisionStatus }>;
  reviewed: readonly DiffFile[];
}

export interface ParsedCheck {
  verdicts: RequirementVerdict[];
  otherFindings: OtherFinding[];
  /** What was dropped or downgraded, in words the reader can act on. */
  notes: string[];
}

const rawVerdict = z.object({
  requirement: z.string(),
  verdict: z.string(),
  explanation: z.string().optional(),
  evidence: z.array(z.object({ path: z.string().optional(), quote: z.string().optional() })).optional(),
});
const rawFinding = z.object({
  category: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  path: z.string().optional(),
});
const rawCheck = z.object({ verdicts: z.array(z.unknown()).optional(), otherFindings: z.array(z.unknown()).optional() });

const VERDICTS: readonly Verdict[] = ['met', 'violated', 'incomplete', 'not_shown'];
const CATEGORIES: ReadonlyArray<OtherFinding['category']> = ['bug', 'security', 'performance'];
/** A quote made only of lines like `}` or `return;` could sit anywhere, so it supports nothing. */
const MIN_EVIDENCE_CHARS = 8;
const NOT_REPORTED = 'The check did not report on this requirement.';
const NO_EVIDENCE = 'The check gave no line from the diff that supports a verdict.';

function normalisePath(path: string): string {
  return path.trim().replace(/^\.\//, '').replace(/^[ab]\//, '');
}

function quoteLines(quote: string): string[] {
  return quote
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[+-]\s?/, '').trim())
    .filter(Boolean);
}

/**
 * Finds a quote in a file's patch, line by line. Returns the diff's own text for the matched lines
 * and the new-file line number of the first, or null when any line is missing.
 */
function locateQuote(quote: string, patch: readonly PatchLine[]): { text: string; line?: number } | null {
  const wanted = quoteLines(quote);
  if (!wanted.some((line) => line.replace(/\s/g, '').length >= MIN_EVIDENCE_CHARS)) return null;
  const matched: PatchLine[] = [];
  for (const line of wanted) {
    const found = patch.find((candidate) => candidate.text.trim() === line);
    if (!found) return null;
    matched.push(found);
  }
  const line = matched.find((item) => item.line !== undefined)?.line;
  return { text: matched.map((item) => item.text.trim()).join('\n'), ...(line !== undefined ? { line } : {}) };
}

/**
 * Parses a check reply at the boundary. The model's verdict is kept only when it names a
 * requirement in the check and quotes lines that are in the reviewed diff; severity always comes
 * from the table, never from the reply.
 */
export function parseCheck(reply: string, context: ParseCheckContext): ParsedCheck {
  const parsed = rawCheck.safeParse(parseJsonReply(reply, 'check'));
  if (!parsed.success) throw new Error('The check reply had no "verdicts" list');

  const inferred = context.scope.length === 0;
  const allowed = new Map<string, { decisionStatus: DecisionStatus; scope: ScopeReason }>(
    inferred
      ? context.candidates.map((claim) => [claim.claimId, { decisionStatus: claim.decisionStatus, scope: 'inferred' }])
      : context.scope.map((claim) => [claim.claimId, { decisionStatus: claim.decisionStatus, scope: claim.scope }]),
  );
  const patches = new Map(context.reviewed.map((file) => [file.path, readPatch(file.patch ?? '')]));
  const verdicts = new Map<string, RequirementVerdict>();
  const notes: string[] = [];

  for (const candidate of parsed.data.verdicts ?? []) {
    const item = rawVerdict.safeParse(candidate);
    if (!item.success) continue;
    const claimId = item.data.requirement.trim();
    const target = allowed.get(claimId);
    const verdict = item.data.verdict.trim() as Verdict;
    if (!target) {
      notes.push(`The check judged ${claimId || 'an unnamed requirement'}, which is not among the requirements checked, and that verdict was dropped.`);
      continue;
    }
    if (verdicts.has(claimId)) {
      notes.push(`The check judged ${claimId} twice; the second verdict was dropped.`);
      continue;
    }
    if (!VERDICTS.includes(verdict)) {
      notes.push(`The check gave ${claimId} an unknown verdict, "${item.data.verdict}", which was dropped.`);
      continue;
    }
    if (inferred && verdict === 'not_shown') continue;

    const evidence: DiffQuote[] = [];
    let unfound = 0;
    for (const quote of verdict === 'not_shown' ? [] : (item.data.evidence ?? [])) {
      const path = normalisePath(quote.path ?? '');
      const patch = patches.get(path);
      const located = patch && quote.quote ? locateQuote(quote.quote, patch) : null;
      if (located) evidence.push({ path, ...(located.line !== undefined ? { line: located.line } : {}), quote: located.text });
      else unfound += 1;
    }
    if (unfound) notes.push(`${unfound} quote${unfound === 1 ? '' : 's'} given for ${claimId} ${unfound === 1 ? 'is' : 'are'} not in the diff and ${unfound === 1 ? 'was' : 'were'} dropped.`);

    const unsupported = verdict !== 'not_shown' && evidence.length === 0;
    if (unsupported) notes.push(`${claimId} was marked ${verdict.replace('_', ' ')} without a line from the diff to support it, so it counts as not shown.`);
    const finalVerdict: Verdict = unsupported ? 'not_shown' : verdict;
    verdicts.set(claimId, {
      claimId,
      scope: target.scope,
      verdict: finalVerdict,
      severity: severityFor(finalVerdict, target.decisionStatus),
      explanation: unsupported ? NO_EVIDENCE : item.data.explanation?.trim() || NO_EVIDENCE,
      evidence,
    });
  }

  if (!inferred) {
    for (const requirement of context.scope) {
      if (verdicts.has(requirement.claimId)) continue;
      verdicts.set(requirement.claimId, {
        claimId: requirement.claimId,
        scope: requirement.scope,
        verdict: 'not_shown',
        severity: null,
        explanation: NOT_REPORTED,
        evidence: [],
      });
    }
  }

  const otherFindings: OtherFinding[] = [];
  for (const candidate of parsed.data.otherFindings ?? []) {
    const finding = rawFinding.safeParse(candidate);
    const title = finding.success ? finding.data.title?.trim() : undefined;
    if (!finding.success || !title) continue;
    const category = CATEGORIES.find((known) => known === finding.data.category) ?? 'bug';
    const path = finding.data.path ? normalisePath(finding.data.path) : undefined;
    otherFindings.push({
      category,
      title,
      description: finding.data.description?.trim() ?? '',
      ...(path && patches.has(path) ? { path } : {}),
    });
  }

  return { verdicts: [...verdicts.values()], otherFindings, notes };
}
