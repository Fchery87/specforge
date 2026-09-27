import type { ParsedClaim } from '../claims';
import { claimState, parseClaimManifest } from '../claims';
import { parseSpecOutline } from '../spec-outline';
import { slugifyHeading } from '../spec-outline';
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

export interface StageReport {
  traceability: TraceabilityReport;
  testability: TestabilityReport;
  coverage: CoverageReport;
  length: LengthReport;
}

export interface StageReportInput {
  /** The stage's document text, which is what the coverage and length dimensions read. */
  markdown: string;
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
 * Which plan sections the document contains, and how many claims each carries.
 *
 * `mergeSectionContent` writes each section as a level-2 heading of its title-cased name, and
 * `parseSpecOutline` reads the same markdown, so slugging both sides matches them without either
 * needing to know the other's spelling.
 *
 * A plan section's claims are counted over its **subtree**, not its own body. `parseSpecOutline` ends a
 * body at the next heading of any level, so a section written as
 * `## Requirements` / `### Functional` / claim would have an empty own body and read as a gap while the
 * claim sits right there under it. Generated sections carry sub-headings often enough that this was the
 * most likely false gap in the report. Starting at a matched heading and absorbing the deeper headings
 * that follow until one at the same or shallower level gives the section's real extent.
 *
 * Absorbing the subtree also means a nested heading cannot be mistaken for another plan section, since
 * the walk skips past it.
 */
function matchSections(
  markdown: string,
  sectionPlan: readonly SectionPlanConfig[]
): {
  present: Set<string>;
  claimsBySection: Map<string, number>;
} {
  const planKeys = new Set(sectionPlan.flatMap(sectionKeys));
  const outline = parseSpecOutline(markdown);
  const present = new Set<string>();
  const claimsBySection = new Map<string, number>();

  let index = 0;
  while (index < outline.sections.length) {
    const section = outline.sections[index];
    const key = slugifyHeading(section.title);

    if (!key || !planKeys.has(key)) {
      index += 1;
      continue;
    }

    let claims = parseClaimManifest(section.body).length;
    let next = index + 1;
    while (next < outline.sections.length && outline.sections[next].level > section.level) {
      claims += parseClaimManifest(outline.sections[next].body).length;
      next += 1;
    }

    present.add(key);
    claimsBySection.set(key, claims);
    index = next;
  }

  return { present, claimsBySection };
}

export function buildStageReport(input: StageReportInput): StageReport {
  const { markdown, claims, sectionPlan, criteria, criterionClassList } = input;

  return {
    traceability: buildTraceability(claims),
    testability: buildTestability(criteria, criterionClassList),
    coverage: buildCoverage(markdown, sectionPlan),
    length: buildLength(markdown, sectionPlan),
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
  markdown: string,
  sectionPlan: readonly SectionPlanConfig[]
): CoverageReport {
  const { present, claimsBySection } = matchSections(markdown, sectionPlan);

  let sections = 0;
  let emptySections = 0;
  const missingSectionIds: string[] = [];

  for (const plan of sectionPlan) {
    const keys = sectionKeys(plan);
    const key = keys.find((candidate) => present.has(candidate));

    if (!key) {
      if (plan.required) missingSectionIds.push(plan.id);
      continue;
    }

    sections += 1;
    if ((claimsBySection.get(key) ?? 0) === 0) emptySections += 1;
  }

  return {
    sections,
    emptySections,
    missingSections: missingSectionIds.length,
    missingSectionIds,
  };
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
