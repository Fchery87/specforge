/**
 * Conformance Validators Index
 * 
 * Pluggable validator system for specification conformance checking.
 * Validates that generated artifacts meet their claimed standards.
 */

import type { ProjectConstitution } from '../constitution-schema';

export interface ConformanceResult {
  validatorId: string;
  passed: boolean;
  score: number; // 0-100
  issues: string[];
}

export interface ConformanceValidator {
  id: string;
  name: string;
  description: string;
  appliesToPhases: string[];
  validate: (
    content: string,
    constitution?: ProjectConstitution,
  ) => ConformanceResult;
}

// Registry of validators
const VALIDATORS: ConformanceValidator[] = [];

/**
 * Registers a conformance validator.
 */
export function registerValidator(validator: ConformanceValidator): void {
  // Check for duplicate IDs
  const existing = VALIDATORS.find((v) => v.id === validator.id);
  if (existing) {
    console.warn(`[conformance] Validator with id "${validator.id}" already exists. Overwriting.`);
    const index = VALIDATORS.indexOf(existing);
    VALIDATORS[index] = validator;
  } else {
    VALIDATORS.push(validator);
  }
}

/**
 * Unregisters a conformance validator.
 */
export function unregisterValidator(validatorId: string): void {
  const index = VALIDATORS.findIndex((v) => v.id === validatorId);
  if (index >= 0) {
    VALIDATORS.splice(index, 1);
  }
}

/**
 * Gets all registered validators.
 */
export function getRegisteredValidators(): ConformanceValidator[] {
  return [...VALIDATORS];
}

/**
 * Runs all applicable conformance checks for a phase.
 */
export function runConformanceChecks(
  content: string,
  phaseId: string,
  constitution?: ProjectConstitution,
): ConformanceResult[] {
  return VALIDATORS.filter((v) => v.appliesToPhases.includes(phaseId)).map((v) =>
    v.validate(content, constitution),
  );
}

/**
 * Runs a specific validator by ID.
 */
export function runValidator(
  validatorId: string,
  content: string,
  constitution?: ProjectConstitution,
): ConformanceResult | null {
  const validator = VALIDATORS.find((v) => v.id === validatorId);
  if (!validator) return null;
  return validator.validate(content, constitution);
}

/**
 * Calculates overall conformance score from results.
 */
export function calculateOverallScore(results: ConformanceResult[]): number {
  if (results.length === 0) return 100;
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  return Math.round(totalScore / results.length);
}

/**
 * Checks if all conformance checks passed.
 */
export function allChecksPassed(results: ConformanceResult[]): boolean {
  return results.every((r) => r.passed);
}
