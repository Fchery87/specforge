/**
 * SIF Exporter
 * 
 * Exports projects to SpecForge Interchange Format (SIF) JSON.
 */

import type { Doc, Id } from '../../convex/_generated/dataModel';
import type { SpecForgeInterchangeFormat, SifPhase, SifArtifact } from './sif-schema';
import { SIF_SCHEMA_URL, SIF_SCHEMA_VERSION, calculateConformanceLevel } from './sif-schema';
import { SPECFORGE_VERSION } from '../llm/provenance';
import { computeContentHash } from '../llm/provenance';
import { PHASE_DEPENDENCIES } from '../specification/dependency-graph';

export interface ExportProject {
  _id: Id<'projects'>;
  title: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

export interface ExportPhase {
  _id: Id<'phases'>;
  projectId: Id<'projects'>;
  phaseId: string;
  status: string;
  isStale?: boolean;
  staleReason?: string;
  driftReport?: {
    driftDetected: boolean;
    driftSummary: string;
    checkedAt: number;
  };
}

export interface ExportArtifact {
  _id: Id<'artifacts'>;
  projectId: Id<'projects'>;
  phaseId: string;
  type: string;
  title: string;
  content: string;
  sections: Array<{ name: string; tokens: number; model: string }>;
  isHidden?: boolean;
  provenance?: {
    constitutionHash?: string;
    modelId: string;
    modelProvider: string;
    promptHash: string;
    temperature: number;
    generatedAt: number;
    specforgeVersion: string;
  };
}

export interface ExportToSifOptions {
  includeHidden?: boolean;
  userId: string;
  constitution?: Record<string, unknown>;
  semanticValidationPassed?: boolean;
  conformanceChecksPassed?: boolean;
}

/**
 * Exports a project to SIF format
 */
export function exportToSif(
  project: ExportProject,
  phases: ExportPhase[],
  artifacts: ExportArtifact[],
  options: ExportToSifOptions,
): SpecForgeInterchangeFormat {
  const { includeHidden = false, userId, constitution, semanticValidationPassed = false, conformanceChecksPassed = false } = options;

  // Group artifacts by phase
  const artifactsByPhase = new Map<string, ExportArtifact[]>();
  for (const artifact of artifacts) {
    if (!includeHidden && artifact.isHidden) continue;
    
    const existing = artifactsByPhase.get(artifact.phaseId) || [];
    existing.push(artifact);
    artifactsByPhase.set(artifact.phaseId, existing);
  }

  // Build SIF phases
  const sifPhases: SifPhase[] = phases.map((phase) => {
    const phaseArtifacts = artifactsByPhase.get(phase.phaseId) || [];
    
    return {
      id: phase.phaseId,
      name: getPhaseDisplayName(phase.phaseId),
      status: phase.status,
      artifacts: phaseArtifacts.map(convertArtifactToSif),
      isStale: phase.isStale,
      staleReason: phase.staleReason,
      driftReport: phase.driftReport
        ? {
            driftDetected: phase.driftReport.driftDetected,
            driftSummary: phase.driftReport.driftSummary,
            checkedAt: phase.driftReport.checkedAt,
          }
        : undefined,
    };
  });

  // Calculate conformance level
  const conformanceLevel = calculateConformanceLevel(
    !!constitution,
    semanticValidationPassed,
    conformanceChecksPassed,
  );

  return {
    $schema: SIF_SCHEMA_URL,
    version: SIF_SCHEMA_VERSION,
    project: {
      title: project.title,
      description: project.description,
      createdAt: new Date(project.createdAt).toISOString(),
      updatedAt: new Date(project.updatedAt).toISOString(),
      specforgeVersion: SPECFORGE_VERSION,
    },
    constitution: constitution as any,
    phases: sifPhases,
    dependencyGraph: PHASE_DEPENDENCIES,
    metadata: {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      conformanceLevel,
    },
  };
}

/**
 * Converts an artifact to SIF format
 */
function convertArtifactToSif(artifact: ExportArtifact): SifArtifact {
  return {
    id: artifact._id.toString(),
    type: artifact.type,
    title: artifact.title,
    content: artifact.content,
    contentHash: computeContentHash(artifact.content),
    provenance: artifact.provenance,
    sections: artifact.sections.map((s) => ({
      name: s.name,
      tokens: s.tokens,
      model: s.model,
    })),
    isHidden: artifact.isHidden,
  };
}

/**
 * Gets display name for a phase
 */
function getPhaseDisplayName(phaseId: string): string {
  const names: Record<string, string> = {
    constitution: 'Project Constitution',
    brief: 'Project Brief',
    prd: 'Product Requirements Document',
    domainModel: 'Domain Model',
    specs: 'Technical Specifications',
    stories: 'User Stories & Tasks',
    artifacts: 'Technical Artifacts',
    handoff: 'Project Handoff',
  };
  return names[phaseId] || phaseId;
}

/**
 * Validates SIF JSON against basic structure requirements
 */
export function validateSif(sif: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sif || typeof sif !== 'object') {
    errors.push('SIF must be an object');
    return { valid: false, errors };
  }

  const sifObj = sif as Record<string, unknown>;

  // Check required fields
  if (!sifObj.$schema) errors.push('Missing $schema');
  if (!sifObj.version) errors.push('Missing version');
  if (!sifObj.project) errors.push('Missing project');
  if (!Array.isArray(sifObj.phases)) errors.push('Missing or invalid phases array');
  if (!sifObj.dependencyGraph) errors.push('Missing dependencyGraph');
  if (!sifObj.metadata) errors.push('Missing metadata');

  // Validate project structure
  if (sifObj.project && typeof sifObj.project === 'object') {
    const project = sifObj.project as Record<string, unknown>;
    if (!project.title) errors.push('Missing project.title');
    if (!project.description) errors.push('Missing project.description');
  }

  // Validate phases
  if (Array.isArray(sifObj.phases)) {
    sifObj.phases.forEach((phase: unknown, index: number) => {
      if (!phase || typeof phase !== 'object') {
        errors.push(`Phase ${index} is not an object`);
        return;
      }
      const p = phase as Record<string, unknown>;
      if (!p.id) errors.push(`Phase ${index} missing id`);
      if (!p.name) errors.push(`Phase ${index} missing name`);
      if (!Array.isArray(p.artifacts)) errors.push(`Phase ${index} missing artifacts array`);
    });
  }

  return { valid: errors.length === 0, errors };
}
