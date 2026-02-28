/**
 * SpecForge Interchange Format (SIF) Schema
 * 
 * Machine-readable JSON format for exporting complete project specifications.
 * Enables interoperability with external tooling, CI/CD pipelines, and code generators.
 */

import type { ProjectConstitution } from '../validation/constitution-schema';
import type { ProvenanceData } from '../llm/provenance';

export const SIF_SCHEMA_VERSION = '1.0.0';
export const SIF_SCHEMA_URL = 'https://specforge.dev/schemas/sif/v1.json';

/**
 * SIF Artifact Section
 */
export interface SifArtifactSection {
  name: string;
  tokens: number;
  model: string;
}

/**
 * SIF Artifact
 */
export interface SifArtifact {
  id: string;
  type: string;
  title: string;
  content: string;
  contentHash: string;
  provenance?: ProvenanceData;
  sections: SifArtifactSection[];
  isHidden?: boolean;
}

/**
 * SIF Phase
 */
export interface SifPhase {
  id: string;
  name: string;
  status: string;
  artifacts: SifArtifact[];
  isStale?: boolean;
  staleReason?: string;
  driftReport?: {
    driftDetected: boolean;
    driftSummary: string;
    checkedAt: number;
  };
}

/**
 * SIF Project Metadata
 */
export interface SifMetadata {
  exportedAt: string;
  exportedBy: string;
  conformanceLevel: 'L0' | 'L1' | 'L2';
}

/**
 * Complete SIF Document
 */
export interface SpecForgeInterchangeFormat {
  $schema: typeof SIF_SCHEMA_URL;
  version: typeof SIF_SCHEMA_VERSION;
  project: {
    title: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    specforgeVersion: string;
  };
  constitution?: ProjectConstitution;
  phases: SifPhase[];
  dependencyGraph: Record<string, string[]>;
  metadata: SifMetadata;
}

/**
 * Conformance levels:
 * - L0: Basic export, minimal validation
 * - L1: Standard export with validation passed
 * - L2: Full export with semantic validation and conformance checks
 */
export type ConformanceLevel = 'L0' | 'L1' | 'L2';

/**
 * Calculates conformance level based on validation results
 */
export function calculateConformanceLevel(
  hasConstitution: boolean,
  semanticValidationPassed: boolean,
  conformanceChecksPassed: boolean,
): ConformanceLevel {
  if (hasConstitution && semanticValidationPassed && conformanceChecksPassed) {
    return 'L2';
  }
  if (hasConstitution && semanticValidationPassed) {
    return 'L1';
  }
  return 'L0';
}
