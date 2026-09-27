import type { ParsedClaim } from '../claims';
import { claimState, parseClaimManifest } from '../claims';
import { parseSpecOutline, slugifyHeading, type SpecSection } from '../spec-outline';
import type { SectionPlanConfig } from '../llm/section-plans';
import { criterionClasses, type StoredCriterionClass } from '../validation/acceptance-criteria';
import { isOverBudget, wordsForTokens } from './budgets';

/**
 * The requirement-quality report.
 *
 * Four dimensions, reported separately and never combined into one number. Each is a different
 * problem with a different fix, so a blended score would let a well-traced four-thousand-word
 * document read the same as a badly-traced nine-hundred-word one.
 *
 * Pure by construction: it takes what it measures and returns what it found. No clock, no database,
 * no model call. `computedAt` and the artifact version list belong to the stored row rather than to
 * the computation, so they are the caller's to supply and this stays testable without a deployment.
 */

export interface TraceabilityReport {
  /** Claims in the document. */
  total: number;
  /** Claims carrying evidence, whether settled or not: `confirmed` plus `proposed`. */
  traced: number;
  /** Claims with no evidence at all. */
  untraced: number;
}

export interface TestabilityReport {
  /** Acceptance criteria found. */
  total: number;
  observable: number;
  unobservable: number;
  vague: number;
  /** Criteria written before the class existed, so nobody judged them at review time. */
  unclassified: number;
}

export interface CoverageReport {
  /** Plan sections present in the document. */
  sections: number;
  /** Present, but carrying no claim. */
  emptySections: number;
  /** Required by the plan and absent from the document. */
  missingSections: number;
  /** Which required sections are absent, so a reader can act rather than only count. */
  missingSectionIds: string[];
}

export interface LengthReport {
  /** Words in the document. */
  words: number;
  /** The same plan estimate this document was written against, in words. */
  budgetWords: number;
  /** Past the budget by more than the stated tolerance. */
  overBudget: boolean;
}

/**
 * One plan section, as the document actually carries it.
 *
 * The spec requires an over-budget section to be marked **where the section is**, not only in a
 * summary, and an empty section to be visible at its own heading. A stage-level word count cannot do
 * that, so each section is resolved to its own extent. `headingKey` is the anchor id of the heading it
 * matched, which is what lets a caller mark the right heading in the rendered document.
 */
export interface SectionQuality {
  /** The plan section's id. */
  id: string;
  title: string;
  /**
   * The phase whose plan defines this section and whose document was measured for it.
   *
   * A caller marking one artifact filters by this. The match was made inside that phase's own
   * document, so a same-named heading in a sibling phase can neither be marked into a document
   * that does not contain it nor satisfy this section from a document that does.
   */
  phaseId: string;
  /** The document heading's anchor id, or null when the section is absent. */
  headingKey: string | null;
  present: boolean;
  /** Present but carrying no claim, so the prose states no requirement. */
  empty: boolean;
  /** Words in the section's heading subtree. */
  words: number;
  budgetWords: number;
  overBudget: boolean;
}

export interface StageReport {
  traceability: TraceabilityReport;
  testability: TestabilityReport;
  coverage: CoverageReport;
  length: LengthReport;
  /**
   * Per-section detail behind the four summaries.
   *
   * The stored row does not carry this: `saveStageReport` persists the four summaries, and this is
   * what the reading surface needs to mark a section at its own heading. Splitting them keeps the
   * stored shape small and lets the detail change without a schema migration.
   */
  sections: SectionQuality[];
}

/**
 * One phase's artifact text, kept whole rather than joined.
 */
export interface StageDocument {
  /** The phase the document belongs to, which ties it to that phase's plan sections. */
  phaseId: string;
  /** The artifact's markdown, measured as its own document. */
  markdown: string;
}

export interface StageReportInput {
  /**
   * The stage's documents, one per measured phase.
   *
   * A section is matched inside the document whose `phaseId` the plan names, and never across the
   * join of the whole stage's text: the reading surface renders one document alone and derives its
   * anchors there, so an anchor of the joined text can be an anchor of no document anyone renders.
   */
  documents: readonly StageDocument[];
  /** The stage's claim records, already parsed. Traceability reads these and nothing else. */
  claims: readonly ParsedClaim[];
  /** The plan the document was written against, which is what coverage and the budget read. */
  sectionPlan: readonly SectionPlanConfig[];
  /** Acceptance criteria, when the stage produced any. */
  criteria?: readonly string[];
  /** Their stored classes, index-aligned. Normalised here, so a misaligned list cannot shift them. */
  criterionClassList?: readonly string[] | null;
}

/**
 * Words in a document, counted as whitespace-separated tokens.
 *
 * Code blocks and table cells count, which is consistent with `estimateTokenCount` counting every
 * character: this is a length estimate for a whole document, not a prose-only measure.
 */
export function countWords(markdown: string): number {
  return markdown.split(/\s+/).filter(Boolean).length;
}

/** Every key a plan section could be written as, so matching does not depend on one spelling. */
function sectionKeys(plan: SectionPlanConfig): string[] {
  const keys = new Set<string>();
  const id = slugifyHeading(plan.id);
  const title = slugifyHeading(plan.title);
  if (id) keys.add(id);
  if (title) keys.add(title);
  return [...keys];
}

/**
 * The keys a document heading can be matched by.
 *
 * `section.id` is the slug of the whole heading text and is the anchor the rendered document carries,
 * which is why it and nothing else may be recorded as `headingKey`. `slugifyHeading(section.title)` is
 * the same slug with the numbering stripped, which is how the plan knows the section: an unnumbered
 * generated heading slugs identically either way, while `## 1. Scope` anchors as `1-scope` and reads
 * as `Scope`. Matching on both is what lets a numbered document be measured, and it is the anchor id
 * that lets a caller mark the heading the reader actually sees.
 */
function documentKeys(section: SpecSection): string[] {
  const keys = new Set<string>();
  const anchor = slugifyHeading(section.id);
  const title = slugifyHeading(section.title);
  if (anchor) keys.add(anchor);
  if (title) keys.add(title);
  return [...keys];
}

/** One plan section the document contains, measured over its heading subtree. */
interface MatchedSection {
  /** The anchor id of the heading that matched, which is what a caller can mark. */
  anchorId: string;
  claims: number;
  words: number;
}

/**
 * Which plan sections one document contains, and what each carries, keyed by the plan key that
 * matched.
 *
 * `mergeSectionContent` writes each section as a level-2 heading of its title-cased name, and
 * `parseSpecOutline` reads the same markdown, so slugging both sides matches them without either
 * needing to know the other's spelling.
 *
 * A plan section's claims and words are counted over its **subtree**, not its own body.
 * `parseSpecOutline` ends a body at the next heading of any level, so a section written as
 * `## Requirements` / `### Functional` / claim would have an empty own body and read as a gap while the
 * claim sits right there under it. Generated sections carry sub-headings often enough that this was the
 * most likely false gap in the report. Starting at a matched heading and absorbing the deeper headings
 * that follow until one at the same or shallower level gives the section's real extent.
 *
 * Absorbing the subtree also means a nested heading cannot be mistaken for another plan section, since
 * the walk skips past it.
 *
 * The same heading can appear twice in one document. Its words and claims exist both times, so they
 * accumulate and the over-budget and empty judgements read the sum. The anchor kept is the first
 * occurrence's, because one mark for two headings is one mark too few rather than one per duplicate.
 */
function matchDocument(
  markdown: string,
  planKeys: ReadonlySet<string>
): Map<string, MatchedSection> {
  const outline = parseSpecOutline(markdown);
  const matched = new Map<string, MatchedSection>();

  let index = 0;
  while (index < outline.sections.length) {
    const section = outline.sections[index];
    const key = documentKeys(section).find((candidate) => planKeys.has(candidate));

    if (!key) {
      index += 1;
      continue;
    }

    let claims = parseClaimManifest(section.body).length;
    let words = countWords(section.body);
    let next = index + 1;
    while (next < outline.sections.length && outline.sections[next].level > section.level) {
      claims += parseClaimManifest(outline.sections[next].body).length;
      words += countWords(outline.sections[next].body);
      next += 1;
    }

    const previous = matched.get(key);
    if (previous) {
      previous.claims += claims;
      previous.words += words;
    } else {
      matched.set(key, { anchorId: section.id, claims, words });
    }
    index = next;
  }

  return matched;
}

/**
 * Match each plan section inside its own phase's document.
 *
 * The result is keyed by phase, and a plan section is looked up only in the document whose
 * `phaseId` matches its plan. The anchor a match records must be an anchor of the document the
 * caller will mark, and the caller renders one phase's document alone, not the joined stage text:
 * matching the join handed back an anchor of a document nobody renders whenever a heading repeated
 * across artifacts, and let one phase's headings satisfy another phase's plan.
 */
function matchSections(
  documents: readonly StageDocument[],
  sectionPlan: readonly SectionPlanConfig[]
): Map<string, Map<string, MatchedSection>> {
  const keysByPhase = new Map<string, Set<string>>();
  for (const plan of sectionPlan) {
    const keys = keysByPhase.get(plan.phaseId) ?? new Set<string>();
    for (const key of sectionKeys(plan)) keys.add(key);
    keysByPhase.set(plan.phaseId, keys);
  }

  const matched = new Map<string, Map<string, MatchedSection>>();
  for (const stageDocument of documents) {
    const planKeys = keysByPhase.get(stageDocument.phaseId);
    if (!planKeys) continue;
    matched.set(stageDocument.phaseId, matchDocument(stageDocument.markdown, planKeys));
  }

  return matched;
}

export function buildStageReport(input: StageReportInput): StageReport {
  const { documents, claims, sectionPlan, criteria, criterionClassList } = input;

  // Each document is parsed once and shared, so coverage and the per-section detail cannot disagree
  // about which headings a plan section matched.
  const matched = matchSections(documents, sectionPlan);
  // The length dimension reads the stage as a whole, which is the join the caller no longer hands
  // in, so it is derived here from the same documents the sections matched inside.
  const stageMarkdown = documents.map((stageDocument) => stageDocument.markdown).join('\n\n');

  return {
    traceability: buildTraceability(claims),
    testability: buildTestability(criteria, criterionClassList),
    coverage: buildCoverage(matched, sectionPlan),
    length: buildLength(stageMarkdown, sectionPlan),
    sections: buildSections(matched, sectionPlan),
  };
}

/**
 * Traceability from the claim records the evidence system already produced.
 *
 * `untraced` is `claimState`'s answer rather than a second rule, so the report and the reading
 * surface cannot disagree about what untraced means. Counts are reported, not a percentage: a
 * project with no claim records reports zeros, which is true, rather than a percentage of nothing.
 */
function buildTraceability(claims: readonly ParsedClaim[]): TraceabilityReport {
  let untraced = 0;

  for (const claim of claims) {
    if (claimState(claim) === 'untraced') untraced += 1;
  }

  return {
    total: claims.length,
    traced: claims.length - untraced,
    untraced,
  };
}

/**
 * Testability from the criteria and the classes stored on them.
 *
 * The class list is normalised through `criterionClasses`, so a stored list of the wrong length
 * cannot shift a class onto the wrong criterion, and a criterion nobody classed reads as
 * `unclassified` rather than being judged now.
 */
function buildTestability(
  criteria: readonly string[] | undefined,
  criterionClassList: readonly string[] | null | undefined
): TestabilityReport {
  const list = criteria ?? [];
  const classes: StoredCriterionClass[] = criterionClasses(list, criterionClassList);

  const report: TestabilityReport = {
    total: list.length,
    observable: 0,
    unobservable: 0,
    vague: 0,
    unclassified: 0,
  };

  for (const className of classes) {
    report[className] += 1;
  }

  return report;
}

/**
 * Coverage against the plan the document was written to.
 *
 * A section is empty when it is present and carries no claim, which is the gap the stage prompt asks
 * a writer to avoid: prose that states no requirement is not coverage. Only required plan sections
 * count as missing, because an optional section is a judgement call rather than a gap.
 */
function buildCoverage(
  matched: Map<string, Map<string, MatchedSection>>,
  sectionPlan: readonly SectionPlanConfig[]
): CoverageReport {
  let sections = 0;
  let emptySections = 0;
  const missingSectionIds: string[] = [];

  for (const plan of sectionPlan) {
    const phaseMatched = matched.get(plan.phaseId);
    const key = sectionKeys(plan).find((candidate) => phaseMatched?.has(candidate));

    if (!key) {
      if (plan.required) missingSectionIds.push(plan.id);
      continue;
    }

    sections += 1;
    if ((phaseMatched?.get(key)?.claims ?? 0) === 0) emptySections += 1;
  }

  return {
    sections,
    emptySections,
    missingSections: missingSectionIds.length,
    missingSectionIds,
  };
}

/**
 * Per-section detail, index-aligned with the plan.
 *
 * Every plan section gets an entry, present or not, so a caller can show what the plan asked for
 * rather than only what the document happens to contain. `headingKey` is the anchor id of the heading
 * that matched, because that is the only key the rendered document has a heading for.
 * `overBudget` is false for an absent section: there is no section to be over anything, and reporting
 * one would double-count the gap that `missingSectionIds` already reports.
 */
function buildSections(
  matched: Map<string, Map<string, MatchedSection>>,
  sectionPlan: readonly SectionPlanConfig[]
): SectionQuality[] {
  return sectionPlan.map((plan) => {
    const phaseMatched = matched.get(plan.phaseId);
    const key = sectionKeys(plan).find((candidate) => phaseMatched?.has(candidate));
    const match = key ? phaseMatched?.get(key) : undefined;
    const words = match?.words ?? 0;
    const budgetWords = wordsForTokens(plan.estimatedTokens);

    return {
      id: plan.id,
      title: plan.title,
      phaseId: plan.phaseId,
      headingKey: match?.anchorId ?? null,
      present: match !== undefined,
      empty: match !== undefined && match.claims === 0,
      words,
      budgetWords,
      overBudget: match !== undefined && isOverBudget(words, budgetWords),
    };
  });
}

/**
 * Length against the plan's own estimate, converted by the budget module.
 *
 * Tokens are summed and converted once, so this agrees with the total the plan preview shows. The
 * budget is advisory: `overBudget` reports a fact and nothing here refuses, truncates or blocks.
 */
function buildLength(
  markdown: string,
  sectionPlan: readonly SectionPlanConfig[]
): LengthReport {
  const words = countWords(markdown);
  const tokens = sectionPlan.reduce((total, plan) => total + plan.estimatedTokens, 0);
  const budgetWords = wordsForTokens(tokens);

  return { words, budgetWords, overBudget: isOverBudget(words, budgetWords) };
}

/**
 * The two counts that put a mark on a stage in the map, and their split.
 *
 * A stage is marked when a requirement has no evidence behind it or a criterion states nothing a
 * check can confirm, which is the difference worth seeing from the overview: the artifact itself
 * explains which section and why.
 *
 * `unclassified` is deliberately excluded and must never be counted as untestable. A criterion
 * written before the class existed was never judged by anyone, so a stage carrying only those has no
 * finding to report, and marking it would relabel the criterion retroactively. That is the same
 * decision the read side of the ticket parser already made.
 */
export interface StageQualityFlag {
  untraced: number;
  unobservable: number;
  vague: number;
}

/** The mark a stage earns, projected from the report the artifact shows. */
export function stageQualityFlagFor(report: StageReport): StageQualityFlag {
  return {
    untraced: report.traceability.untraced,
    unobservable: report.testability.unobservable,
    vague: report.testability.vague,
  };
}
