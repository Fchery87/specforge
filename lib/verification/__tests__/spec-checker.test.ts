import { describe, it, expect } from 'vitest';
import {
  parseGitDiff,
  extractRelevantSpecs,
  buildVerificationPrompt,
  parseVerificationResponse,
  calculateScoreFromFindings,
  type Finding,
} from '../spec-checker';

describe('spec-checker', () => {
  describe('parseGitDiff', () => {
    it('should parse a simple git diff with one file', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/app.ts
@@ -0,0 +1,10 @@
+import express from 'express';
+const app = express();
+app.listen(3000);`;

      const files = parseGitDiff(diff);
      
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('src/app.ts');
      expect(files[0].status).toBe('added');
      expect(files[0].additions).toBe(3);
      expect(files[0].deletions).toBe(0);
    });

    it('should parse multiple files', () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,5 @@
-import http from 'http';
+import express from 'express';
 
diff --git a/package.json b/package.json
new file mode 100644
--- /dev/null
+++ b/package.json`;

      const files = parseGitDiff(diff);
      
      expect(files).toHaveLength(2);
      expect(files[0].path).toBe('src/app.ts');
      expect(files[1].path).toBe('package.json');
    });

    it('should handle deleted files', () => {
      const diff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1,10 +0,0 @@
-old code`;

      const files = parseGitDiff(diff);
      
      expect(files).toHaveLength(1);
      expect(files[0].status).toBe('deleted');
    });

    it('should handle empty diff', () => {
      const files = parseGitDiff('');
      expect(files).toHaveLength(0);
    });
  });

  describe('extractRelevantSpecs', () => {
    it('should extract spec content from artifacts', () => {
      const changedFiles = [{ path: 'src/app.ts', status: 'modified' as const, additions: 5, deletions: 2, diffContent: '' }];
      const artifacts = [
        { type: 'techSpec', content: '# Technical Spec\n\nAPI endpoints...' },
        { type: 'userStories', content: '# User Stories\n\nAs a user...' },
      ];

      const specs = extractRelevantSpecs(changedFiles, artifacts);

      expect(specs).toContain('TECHSPEC');
      expect(specs).toContain('USERSTORIES');
      expect(specs).toContain('API endpoints...');
    });

    it('should skip artifacts with empty content', () => {
      const changedFiles = [{ path: 'src/app.ts', status: 'modified' as const, additions: 5, deletions: 2, diffContent: '' }];
      const artifacts = [
        { type: 'techSpec', content: 'Valid content' },
        { type: 'empty', content: '' },
      ];

      const specs = extractRelevantSpecs(changedFiles, artifacts);

      expect(specs).toContain('TECHSPEC');
      expect(specs).toContain('Valid content');
      expect(specs).not.toContain('empty');
    });
  });

  describe('buildVerificationPrompt', () => {
    it('should build a prompt with all required sections', () => {
      const params = {
        projectTitle: 'Test Project',
        specContent: '# Spec\n\nRequirements...',
        gitDiff: 'diff content',
        changedFiles: [
          { path: 'src/app.ts', status: 'modified' as const, additions: 5, deletions: 2, diffContent: '' },
        ],
      };

      const prompt = buildVerificationPrompt(params);

      expect(prompt).toContain('Test Project');
      expect(prompt).toContain('Requirements...');
      expect(prompt).toContain('diff content');
      expect(prompt).toContain('src/app.ts');
      expect(prompt).toContain('modified');
      expect(prompt).toContain('JSON object');
    });
  });

  describe('parseVerificationResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        findings: [
          {
            category: 'bug',
            severity: 'critical',
            title: 'Missing validation',
            description: 'No input validation',
            suggestion: 'Add validation',
          },
        ],
        overallScore: 75,
        status: 'warning',
      });

      const result = parseVerificationResponse(response);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].category).toBe('bug');
      expect(result.findings[0].severity).toBe('critical');
      expect(result.overallScore).toBe(75);
      expect(result.status).toBe('warning');
    });

    it('should extract JSON from code blocks', () => {
      const response = `
Here's the analysis:

\`\`\`json
{
  "findings": [],
  "overallScore": 95,
  "status": "pass"
}
\`\`\`
      `;

      const result = parseVerificationResponse(response);

      expect(result.findings).toHaveLength(0);
      expect(result.overallScore).toBe(95);
      expect(result.status).toBe('pass');
    });

    it('should normalize invalid categories', () => {
      const response = JSON.stringify({
        findings: [{ category: 'invalid', severity: 'invalid', title: 'Test', description: '', suggestion: '' }],
        overallScore: 50,
        status: 'invalid',
      });

      const result = parseVerificationResponse(response);

      expect(result.findings[0].category).toBe('clarity');
      expect(result.findings[0].severity).toBe('minor');
    });

    it('should return fallback on invalid JSON', () => {
      const response = 'not valid json';

      const result = parseVerificationResponse(response);

      expect(result.status).toBe('fail');
      expect(result.findings[0].title).toContain('Failed to parse');
    });
  });

  describe('calculateScoreFromFindings', () => {
    it('should return 100 for no findings', () => {
      expect(calculateScoreFromFindings([])).toBe(100);
    });

    it('should deduct points for critical findings', () => {
      const findings: Finding[] = [
        { category: 'bug', severity: 'critical', title: 'Test', description: '', suggestion: '' },
      ];
      expect(calculateScoreFromFindings(findings)).toBe(75);
    });

    it('should deduct points for major findings', () => {
      const findings: Finding[] = [
        { category: 'bug', severity: 'major', title: 'Test', description: '', suggestion: '' },
      ];
      expect(calculateScoreFromFindings(findings)).toBe(90);
    });

    it('should deduct points for minor findings', () => {
      const findings: Finding[] = [
        { category: 'clarity', severity: 'minor', title: 'Test', description: '', suggestion: '' },
      ];
      expect(calculateScoreFromFindings(findings)).toBe(97);
    });

    it('should calculate score for mixed findings', () => {
      const findings: Finding[] = [
        { category: 'bug', severity: 'critical', title: 'Test', description: '', suggestion: '' },
        { category: 'performance', severity: 'major', title: 'Test', description: '', suggestion: '' },
        { category: 'clarity', severity: 'minor', title: 'Test', description: '', suggestion: '' },
      ];
      expect(calculateScoreFromFindings(findings)).toBe(62); // 100 - 25 - 10 - 3
    });

    it('should not go below 0', () => {
      const findings: Finding[] = Array(10).fill({
        category: 'bug',
        severity: 'critical',
        title: 'Test',
        description: '',
        suggestion: '',
      });
      expect(calculateScoreFromFindings(findings)).toBe(0);
    });
  });
});
