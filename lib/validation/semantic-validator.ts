/**
 * Semantic Constitution Validator
 * 
 * Performs rule-based semantic validation beyond structural Zod validation.
 * Detects logical contradictions and quality issues in the constitution.
 */

import type { ProjectConstitution } from './constitution-schema';

export interface SemanticWarning {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  field: string;
  suggestion: string;
}

interface SemanticRule {
  id: string;
  description: string;
  check: (constitution: ProjectConstitution) => SemanticWarning | null;
}

const SEMANTIC_RULES: SemanticRule[] = [
  {
    id: 'arch-db-alignment',
    description: 'Architecture pattern should align with database choice',
    check: (c) => {
      const arch = c.architecture.pattern.toLowerCase();
      const db = c.techStack.database.type.toLowerCase();
      if (arch.includes('microservice') && db.includes('sqlite')) {
        return {
          ruleId: 'arch-db-alignment',
          severity: 'error',
          message: 'Microservices architecture with SQLite is contradictory',
          field: 'techStack.database.type',
          suggestion: 'Use PostgreSQL, MongoDB, or a distributed database',
        };
      }
      return null;
    },
  },
  {
    id: 'performance-ssr-alignment',
    description: 'Performance targets should be achievable with stated stack',
    check: (c) => {
      const ttfb = c.qualityStandards.performance.ttfbTarget;
      const isSPA = c.architecture.pattern.toLowerCase().includes('spa');
      if (ttfb.includes('100ms') && isSPA) {
        return {
          ruleId: 'performance-ssr-alignment',
          severity: 'warning',
          message: '<100ms TTFB is difficult to achieve with a pure SPA',
          field: 'qualityStandards.performance.ttfbTarget',
          suggestion: 'Consider SSR/SSG or increase TTFB target to <200ms',
        };
      }
      return null;
    },
  },
  {
    id: 'security-auth-completeness',
    description: 'Security requirements should include auth details',
    check: (c) => {
      const auth = c.qualityStandards.security.authentication;
      if (!auth || auth === 'none' || auth === 'N/A') {
        return {
          ruleId: 'security-auth-completeness',
          severity: 'warning',
          message: 'No authentication strategy defined',
          field: 'qualityStandards.security.authentication',
          suggestion:
            'Specify auth method: JWT, OAuth 2.0, Session-based, etc.',
        };
      }
      return null;
    },
  },
  {
    id: 'forbidden-stack-conflict',
    description: 'Forbidden patterns should not conflict with tech stack',
    check: (c) => {
      const stack = JSON.stringify(c.techStack).toLowerCase();
      for (const fp of c.forbiddenPatterns) {
        const pattern = fp.pattern.toLowerCase();
        if (stack.includes(pattern)) {
          return {
            ruleId: 'forbidden-stack-conflict',
            severity: 'error',
            message: `Forbidden pattern "${fp.pattern}" appears in tech stack`,
            field: 'forbiddenPatterns',
            suggestion: `Remove "${fp.pattern}" from forbidden list or change tech stack`,
          };
        }
      }
      return null;
    },
  },
  {
    id: 'testing-coverage-realistic',
    description: 'Testing coverage targets should be realistic',
    check: (c) => {
      const coverage = c.qualityStandards.testing.unitCoverage;
      const coverageNum = typeof coverage === 'number' ? coverage : parseInt(coverage);
      if (!isNaN(coverageNum) && coverageNum > 95) {
        return {
          ruleId: 'testing-coverage-realistic',
          severity: 'warning',
          message: `Unit test coverage target of ${coverageNum}% may be difficult to maintain`,
          field: 'qualityStandards.testing.unitCoverage',
          suggestion: 'Consider 80-90% coverage for better maintainability',
        };
      }
      return null;
    },
  },
  {
    id: 'frontend-backend-alignment',
    description: 'Frontend and backend frameworks should be compatible',
    check: (c) => {
      const frontend = c.techStack.frontend.framework.toLowerCase();
      const backend = c.techStack.backend.framework.toLowerCase();
      
      // Check for common mismatches
      if (frontend.includes('next') && !backend.includes('node') && !backend.includes('express')) {
        // This is just a warning, not an error, as Next.js can work with any backend
        return {
          ruleId: 'frontend-backend-alignment',
          severity: 'warning',
          message: `Next.js frontend with ${c.techStack.backend.framework} backend may require additional configuration`,
          field: 'techStack.backend.framework',
          suggestion: 'Consider using a Node.js backend for optimal Next.js integration',
        };
      }
      return null;
    },
  },
];

/**
 * Validates the constitution against semantic rules.
 * Returns an array of warnings (empty if no issues found).
 */
export function validateSemantics(
  constitution: ProjectConstitution,
): SemanticWarning[] {
  return SEMANTIC_RULES.map((rule) => rule.check(constitution)).filter(
    (w): w is SemanticWarning => w !== null,
  );
}

/**
 * Checks if any blocking errors exist in the warnings.
 */
export function hasBlockingErrors(warnings: SemanticWarning[]): boolean {
  return warnings.some((w) => w.severity === 'error');
}

/**
 * Gets only the errors (excluding warnings).
 */
export function getErrors(warnings: SemanticWarning[]): SemanticWarning[] {
  return warnings.filter((w) => w.severity === 'error');
}

/**
 * Gets only the warnings (excluding errors).
 */
export function getWarnings(warnings: SemanticWarning[]): SemanticWarning[] {
  return warnings.filter((w) => w.severity === 'warning');
}
