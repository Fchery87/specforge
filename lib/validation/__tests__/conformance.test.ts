import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerValidator,
  unregisterValidator,
  getRegisteredValidators,
  runConformanceChecks,
  runValidator,
  calculateOverallScore,
  allChecksPassed,
  type ConformanceValidator,
} from '../conformance';
import { completenessChecker } from '../conformance/completeness-checker';
import { apiSchemaValidator } from '../conformance/api-schema-validator';
import { securityCoverageValidator } from '../conformance/security-coverage';

describe('conformance validators', () => {
  beforeEach(() => {
    // Clear all registered validators before each test
    const validators = getRegisteredValidators();
    validators.forEach((v) => unregisterValidator(v.id));
  });

  describe('registry', () => {
    it('should register a validator', () => {
      registerValidator(completenessChecker);
      const validators = getRegisteredValidators();
      expect(validators).toHaveLength(1);
      expect(validators[0].id).toBe('completeness-checker');
    });

    it('should unregister a validator', () => {
      registerValidator(completenessChecker);
      unregisterValidator('completeness-checker');
      const validators = getRegisteredValidators();
      expect(validators).toHaveLength(0);
    });

    it('should overwrite existing validator with same ID', () => {
      registerValidator(completenessChecker);
      const modifiedValidator = { ...completenessChecker, name: 'Modified' };
      registerValidator(modifiedValidator);
      const validators = getRegisteredValidators();
      expect(validators).toHaveLength(1);
      expect(validators[0].name).toBe('Modified');
    });
  });

  describe('runConformanceChecks', () => {
    it('should run all applicable validators for a phase', () => {
      registerValidator(completenessChecker);
      registerValidator(apiSchemaValidator);
      
      const results = runConformanceChecks('# Test\n\nContent here', 'specs');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should only run validators that apply to the phase', () => {
      registerValidator(apiSchemaValidator); // Only applies to specs, techSpec
      
      const specsResults = runConformanceChecks('Content', 'specs');
      const briefResults = runConformanceChecks('Content', 'brief');
      
      expect(specsResults.length).toBe(1);
      expect(briefResults.length).toBe(0);
    });
  });

  describe('runValidator', () => {
    it('should run a specific validator by ID', () => {
      registerValidator(completenessChecker);
      
      const result = runValidator('completeness-checker', '# Test\n\nContent');
      expect(result).not.toBeNull();
      expect(result?.validatorId).toBe('completeness-checker');
    });

    it('should return null for non-existent validator', () => {
      const result = runValidator('non-existent', 'Content');
      expect(result).toBeNull();
    });
  });

  describe('calculateOverallScore', () => {
    it('should return 100 for empty results', () => {
      expect(calculateOverallScore([])).toBe(100);
    });

    it('should calculate average score', () => {
      const results = [
        { validatorId: 'v1', passed: true, score: 80, issues: [] },
        { validatorId: 'v2', passed: true, score: 100, issues: [] },
      ];
      expect(calculateOverallScore(results)).toBe(90);
    });
  });

  describe('allChecksPassed', () => {
    it('should return true when all checks pass', () => {
      const results = [
        { validatorId: 'v1', passed: true, score: 100, issues: [] },
        { validatorId: 'v2', passed: true, score: 100, issues: [] },
      ];
      expect(allChecksPassed(results)).toBe(true);
    });

    it('should return false when any check fails', () => {
      const results = [
        { validatorId: 'v1', passed: true, score: 100, issues: [] },
        { validatorId: 'v2', passed: false, score: 50, issues: ['Issue'] },
      ];
      expect(allChecksPassed(results)).toBe(false);
    });
  });

  describe('completenessChecker', () => {
    it('should pass for complete content', () => {
      const content = `
# Section 1
Content here with enough length to pass the minimum requirement check. This needs to be at least 100 characters long.

## Subsection
- Item 1
- Item 2
- Item 3

\`\`\`typescript
const code = "example";
\`\`\`
      `;
      const result = completenessChecker.validate(content);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should fail for minimal content', () => {
      const result = completenessChecker.validate('Short');
      expect(result.passed).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('apiSchemaValidator', () => {
    it('should pass for valid API spec', () => {
      const content = `
## Endpoints

### GET /api/users
Returns a list of users.

Request:
- Query params: page, limit

Response:
- 200 OK: Array of users
- Content-Type: application/json

### POST /api/users
Creates a new user.

Request Body:
- name: string
- email: string

Response:
- 201 Created
      `;
      const result = apiSchemaValidator.validate(content);
      expect(result.passed).toBe(true);
    });

    it('should fail for missing HTTP methods', () => {
      const content = 'Some API documentation without methods';
      const result = apiSchemaValidator.validate(content);
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.includes('HTTP'))).toBe(true);
    });
  });

  describe('securityCoverageValidator', () => {
    it('should calculate OWASP coverage', () => {
      const content = `
Security Considerations:
- Access control is implemented via JWT tokens
- All data is encrypted using AES-256
- SQL injection is prevented using parameterized queries
- Authentication requires MFA
      `;
      const result = securityCoverageValidator.validate(content);
      expect(result.score).toBeGreaterThan(0);
      expect(result.validatorId).toBe('security-coverage');
    });

    it('should identify missing critical categories', () => {
      const content = 'Basic security info';
      const result = securityCoverageValidator.validate(content);
      expect(result.issues.some(i => i.includes('critical'))).toBe(true);
    });
  });
});
