/**
 * Spec-to-Code Diff Checker
 *
 * Parses git diffs and compares them against specifications to verify
 * implementation correctness.
 */

export type FindingCategory = 'bug' | 'performance' | 'security' | 'clarity' | 'missing';
export type FindingSeverity = 'critical' | 'major' | 'minor';
export type VerificationStatus = 'pass' | 'fail' | 'warning';

export interface Finding {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  suggestion: string;
  specReference?: string;
}

export interface VerificationResult {
  findings: Finding[];
  overallScore: number;
  status: VerificationStatus;
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diffContent: string;
}

/**
 * Parse a git diff string into structured file changes
 */
export function parseGitDiff(diffText: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const diffBlocks = diffText.split('diff --git').filter(Boolean);

  for (const block of diffBlocks) {
    const fileInfo = extractFileInfo(block);
    if (fileInfo) {
      files.push(fileInfo);
    }
  }

  return files;
}

function extractFileInfo(diffBlock: string): ChangedFile | null {
  // Extract file path from the diff header
  const pathMatch = diffBlock.match(/^ a\/(.+) b\/(.+)/m);
  if (!pathMatch) return null;

  const oldPath = pathMatch[1];
  const newPath = pathMatch[2];
  const path = newPath || oldPath;

  // Determine file status
  let status: ChangedFile['status'] = 'modified';
  if (diffBlock.includes('new file mode')) {
    status = 'added';
  } else if (diffBlock.includes('deleted file mode')) {
    status = 'deleted';
  } else if (diffBlock.includes('rename from') && diffBlock.includes('rename to')) {
    status = 'renamed';
  }

  // Count additions and deletions
  const additions = (diffBlock.match(/^\+[^+]/gm) || []).length;
  const deletions = (diffBlock.match(/^-[^-]/gm) || []).length;

  // Extract the actual diff content (hunks)
  const hunks = diffBlock.match(/@@ [^@]+ @@.*$/ms);
  const diffContent = hunks ? hunks[0] : diffBlock;

  return {
    path,
    status,
    additions,
    deletions,
    diffContent: diffContent.slice(0, 5000), // Limit content size
  };
}

/**
 * Extract relevant spec content based on changed files
 */
export function extractRelevantSpecs(
  changedFiles: ChangedFile[],
  specArtifacts: Array<{ type: string; content: string }>,
): string {
  const relevantSections: string[] = [];

  for (const artifact of specArtifacts) {
    if (!artifact.content) continue;

    // Include all spec content for now - LLM will filter
    relevantSections.push(`## ${artifact.type.toUpperCase()}\n\n${artifact.content}`);
  }

  return relevantSections.join('\n\n---\n\n');
}

/**
 * Build the verification prompt for LLM comparison
 */
export function buildVerificationPrompt(params: {
  projectTitle: string;
  specContent: string;
  gitDiff: string;
  changedFiles: ChangedFile[];
}): string {
  const { projectTitle, specContent, gitDiff, changedFiles } = params;

  const fileSummary = changedFiles
    .map((f) => `- ${f.path} (${f.status}, +${f.additions}/-${f.deletions})`)
    .join('\n');

  return `You are a Principal Engineer performing a code review to verify that an implementation matches its specification.

## Task
Compare the provided git diff (implementation changes) against the specification to identify:
1. Requirements from the spec that are NOT implemented
2. Implementation that contradicts the spec
3. Bugs or issues in the implementation
4. Missing error handling, validation, or edge cases
5. Performance or security concerns

## Project
${projectTitle}

## Changed Files
${fileSummary}

## Specification
${specContent.slice(0, 10000)}

## Git Diff (Implementation)
\`\`\`diff
${gitDiff.slice(0, 8000)}
\`\`\`

## Response Format
Return ONLY a JSON object with this structure:
{
  "findings": [
    {
      "category": "bug" | "performance" | "security" | "clarity" | "missing",
      "severity": "critical" | "major" | "minor",
      "title": "Brief issue title",
      "description": "Detailed description of the issue",
      "suggestion": "Specific recommendation to fix",
      "specReference": "Optional reference to spec section"
    }
  ],
  "overallScore": 0-100,
  "status": "pass" | "fail" | "warning"
}

Scoring:
- 90-100: pass (minor issues at most)
- 70-89: warning (some issues that should be addressed)
- 0-69: fail (significant gaps or problems)

Be thorough but constructive. Every finding should be actionable.`;
}

/**
 * Parse LLM response into structured findings
 */
export function parseVerificationResponse(response: string): VerificationResult {
  try {
    // Try to extract JSON from code block first
    const codeBlockMatch = response.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1] : response;

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the response
    const findings: Finding[] = (parsed.findings || []).map((f: Partial<Finding>) => ({
      category: normalizeCategory(f.category),
      severity: normalizeSeverity(f.severity),
      title: f.title || 'Untitled finding',
      description: f.description || '',
      suggestion: f.suggestion || '',
      specReference: f.specReference,
    }));

    const overallScore = Math.max(0, Math.min(100, Math.round(parsed.overallScore || 0)));
    const status = normalizeStatus(parsed.status, overallScore);

    return {
      findings,
      overallScore,
      status,
    };
  } catch (error) {
    console.error('Failed to parse verification response:', error);

    // Return a fallback result
    return {
      findings: [
        {
          category: 'clarity',
          severity: 'major',
          title: 'Failed to parse verification results',
          description: 'The LLM response could not be parsed. Please try again.',
          suggestion: 'Retry the verification or check the implementation manually.',
        },
      ],
      overallScore: 0,
      status: 'fail',
    };
  }
}

function normalizeCategory(category: unknown): FindingCategory {
  const validCategories: FindingCategory[] = ['bug', 'performance', 'security', 'clarity', 'missing'];
  if (typeof category === 'string' && validCategories.includes(category as FindingCategory)) {
    return category as FindingCategory;
  }
  return 'clarity';
}

function normalizeSeverity(severity: unknown): FindingSeverity {
  const validSeverities: FindingSeverity[] = ['critical', 'major', 'minor'];
  if (typeof severity === 'string' && validSeverities.includes(severity as FindingSeverity)) {
    return severity as FindingSeverity;
  }
  return 'minor';
}

function normalizeStatus(status: unknown, score: number): VerificationStatus {
  if (status === 'pass' || status === 'fail' || status === 'warning') {
    return status;
  }
  // Derive from score
  if (score >= 90) return 'pass';
  if (score >= 70) return 'warning';
  return 'fail';
}

/**
 * Calculate overall score from findings using weighted deduction
 */
export function calculateScoreFromFindings(findings: Finding[]): number {
  if (findings.length === 0) return 100;

  const severityWeights = {
    critical: 25,
    major: 10,
    minor: 3,
  };

  const totalDeduction = findings.reduce((sum, finding) => {
    return sum + severityWeights[finding.severity];
  }, 0);

  return Math.max(0, 100 - totalDeduction);
}
