import { describe, it, expect } from 'vitest';
import {
  validateSemantics,
  hasBlockingErrors,
  getErrors,
  getWarnings,
  type SemanticWarning,
} from '../semantic-validator';
import type { ProjectConstitution } from '../constitution-schema';

describe('semantic-validator', () => {
  const validConstitution: ProjectConstitution = {
    lockedConstraints: {
      stateInvariants: ['Data integrity must be maintained'],
      domainRules: ['Business rules go here'],
      securityProtocols: ['Use HTTPS'],
    },
    architecture: {
      pattern: 'Monolithic',
      stateManagement: 'React Context',
      apiDesign: 'REST',
      dataFlow: 'Unidirectional',
      rationale: 'Simple and maintainable',
    },
    techStack: {
      frontend: {
        framework: 'React',
        version: '18',
        language: 'TypeScript',
      },
      backend: {
        runtime: 'Node.js',
        framework: 'Express',
        version: '4',
      },
      database: {
        type: 'PostgreSQL',
        orm: 'Prisma',
        hosting: 'AWS RDS',
      },
      styling: {
        approach: 'CSS Modules',
        uiLibrary: 'Radix UI',
      },
      keyDependencies: ['react', 'express'],
    },
    qualityStandards: {
      accessibility: {
        wcagLevel: 'AA',
        targetCompliance: '100%',
        requirements: ['Keyboard navigation'],
      },
      performance: {
        bundleSizeLimit: '200KB',
        ttfbTarget: '<200ms',
        lcpTarget: '<2.5s',
        requirements: ['Lazy loading'],
      },
      security: {
        authentication: 'JWT',
        authorization: 'RBAC',
        requirements: ['Input validation'],
      },
      testing: {
        unitCoverage: 85,
        integrationRequired: true,
        e2eRequired: true,
      },
    },
    namingConventions: {
      files: {
        components: 'PascalCase',
        utilities: 'camelCase',
        styles: 'kebab-case',
      },
      components: 'PascalCase',
      functions: 'camelCase',
      variables: 'camelCase',
      constants: 'SCREAMING_SNAKE_CASE',
    },
    forbiddenPatterns: [
      {
        pattern: 'eval()',
        reason: 'Security risk',
        alternative: 'Use safe parsing',
      },
    ],
    globalConstraints: {
      browserSupport: ['Chrome', 'Firefox'],
      deviceCompatibility: ['Desktop', 'Mobile'],
      compliance: ['GDPR'],
      deployment: {
        platform: 'AWS',
        constraints: ['Use us-east-1'],
      },
    },
  };

  describe('validateSemantics', () => {
    it('should return empty array for valid constitution', () => {
      const warnings = validateSemantics(validConstitution);
      expect(warnings).toEqual([]);
    });

    it('should detect microservices with SQLite (arch-db-alignment)', () => {
      const invalid = {
        ...validConstitution,
        architecture: {
          ...validConstitution.architecture,
          pattern: 'Microservices',
        },
        techStack: {
          ...validConstitution.techStack,
          database: {
            ...validConstitution.techStack.database,
            type: 'SQLite',
          },
        },
      };
      const warnings = validateSemantics(invalid);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].ruleId).toBe('arch-db-alignment');
      expect(warnings[0].severity).toBe('error');
      expect(warnings[0].message).toContain('Microservices');
    });

    it('should detect SPA with aggressive TTFB target (performance-ssr-alignment)', () => {
      const invalid = {
        ...validConstitution,
        architecture: {
          ...validConstitution.architecture,
          pattern: 'SPA',
        },
        qualityStandards: {
          ...validConstitution.qualityStandards,
          performance: {
            ...validConstitution.qualityStandards.performance,
            ttfbTarget: '<100ms',
          },
        },
      };
      const warnings = validateSemantics(invalid);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].ruleId).toBe('performance-ssr-alignment');
      expect(warnings[0].severity).toBe('warning');
    });

    it('should detect missing authentication (security-auth-completeness)', () => {
      const invalid = {
        ...validConstitution,
        qualityStandards: {
          ...validConstitution.qualityStandards,
          security: {
            ...validConstitution.qualityStandards.security,
            authentication: 'none',
          },
        },
      };
      const warnings = validateSemantics(invalid);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].ruleId).toBe('security-auth-completeness');
      expect(warnings[0].severity).toBe('warning');
    });

    it('should detect forbidden pattern in tech stack (forbidden-stack-conflict)', () => {
      const invalid = {
        ...validConstitution,
        techStack: {
          ...validConstitution.techStack,
          frontend: {
            ...validConstitution.techStack.frontend,
            framework: 'eval() framework',
          },
        },
        forbiddenPatterns: [
          {
            pattern: 'eval()',
            reason: 'Security risk',
            alternative: 'Use safe parsing',
          },
        ],
      };
      const warnings = validateSemantics(invalid);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].ruleId).toBe('forbidden-stack-conflict');
      expect(warnings[0].severity).toBe('error');
    });

    it('should detect unrealistic coverage target (testing-coverage-realistic)', () => {
      const invalid = {
        ...validConstitution,
        qualityStandards: {
          ...validConstitution.qualityStandards,
          testing: {
            ...validConstitution.qualityStandards.testing,
            unitCoverage: 99,
          },
        },
      };
      const warnings = validateSemantics(invalid);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].ruleId).toBe('testing-coverage-realistic');
      expect(warnings[0].severity).toBe('warning');
    });

    it('should detect multiple issues at once', () => {
      const invalid = {
        ...validConstitution,
        architecture: {
          ...validConstitution.architecture,
          pattern: 'Microservices',
        },
        techStack: {
          ...validConstitution.techStack,
          database: {
            ...validConstitution.techStack.database,
            type: 'SQLite',
          },
        },
        qualityStandards: {
          ...validConstitution.qualityStandards,
          security: {
            ...validConstitution.qualityStandards.security,
            authentication: 'none',
          },
        },
      };
      const warnings = validateSemantics(invalid);
      expect(warnings.length).toBeGreaterThanOrEqual(2);
      const errors = warnings.filter((w) => w.severity === 'error');
      const warns = warnings.filter((w) => w.severity === 'warning');
      expect(errors).toHaveLength(1); // arch-db-alignment
      expect(warns.length).toBeGreaterThanOrEqual(1); // security-auth-completeness
    });
  });

  describe('hasBlockingErrors', () => {
    it('should return false for empty warnings', () => {
      expect(hasBlockingErrors([])).toBe(false);
    });

    it('should return false for warnings only', () => {
      const warnings: SemanticWarning[] = [
        {
          ruleId: 'test',
          severity: 'warning',
          message: 'Test',
          field: 'test',
          suggestion: 'Fix it',
        },
      ];
      expect(hasBlockingErrors(warnings)).toBe(false);
    });

    it('should return true for errors', () => {
      const warnings: SemanticWarning[] = [
        {
          ruleId: 'test',
          severity: 'error',
          message: 'Test',
          field: 'test',
          suggestion: 'Fix it',
        },
      ];
      expect(hasBlockingErrors(warnings)).toBe(true);
    });
  });

  describe('getErrors', () => {
    it('should filter only errors', () => {
      const warnings: SemanticWarning[] = [
        {
          ruleId: 'error1',
          severity: 'error',
          message: 'Error',
          field: 'field1',
          suggestion: 'Fix',
        },
        {
          ruleId: 'warning1',
          severity: 'warning',
          message: 'Warning',
          field: 'field2',
          suggestion: 'Fix',
        },
      ];
      const errors = getErrors(warnings);
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleId).toBe('error1');
    });
  });

  describe('getWarnings', () => {
    it('should filter only warnings', () => {
      const warnings: SemanticWarning[] = [
        {
          ruleId: 'error1',
          severity: 'error',
          message: 'Error',
          field: 'field1',
          suggestion: 'Fix',
        },
        {
          ruleId: 'warning1',
          severity: 'warning',
          message: 'Warning',
          field: 'field2',
          suggestion: 'Fix',
        },
      ];
      const warns = getWarnings(warnings);
      expect(warns).toHaveLength(1);
      expect(warns[0].ruleId).toBe('warning1');
    });
  });
});
