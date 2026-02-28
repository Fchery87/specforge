/**
 * Phase Registry
 * 
 * Declarative phase system for customizable specification pipelines.
 * Allows adding, removing, or reordering phases without code changes across multiple files.
 */

import type { SectionPlanConfig } from '../llm/section-plans';
import {
  CONSTITUTION_SECTIONS,
  BRIEF_SECTIONS,
  PRD_SECTIONS,
  DOMAIN_MODEL_SECTIONS,
  SPECIFICATIONS_SECTIONS,
  USER_STORIES_SECTIONS,
  ARTIFACTS_SECTIONS,
  HANDOFF_SECTIONS,
} from '../llm/section-plans';

/**
 * Phase definition interface
 */
export interface PhaseDefinition {
  id: string;
  name: string;
  description: string;
  artifactType: string;
  sections: SectionPlanConfig[];
  dependencies: string[];
  isRequired: boolean;
  isHidden: boolean;
  validators: string[]; // Validator IDs from conformance registry
}

// Registry storage
const PHASE_REGISTRY = new Map<string, PhaseDefinition>();

/**
 * Registers a phase in the registry
 */
export function registerPhase(def: PhaseDefinition): void {
  // Validate dependency chain is acyclic
  if (wouldCreateCycle(def)) {
    throw new Error(`Phase "${def.id}" would create a dependency cycle`);
  }
  
  // Validate all dependencies exist
  for (const dep of def.dependencies) {
    if (!PHASE_REGISTRY.has(dep)) {
      throw new Error(`Phase "${def.id}" depends on unknown phase "${dep}"`);
    }
  }
  
  PHASE_REGISTRY.set(def.id, def);
}

/**
 * Unregisters a phase from the registry
 */
export function unregisterPhase(phaseId: string): boolean {
  // Check if other phases depend on this one
  for (const [id, phase] of PHASE_REGISTRY.entries()) {
    if (phase.dependencies.includes(phaseId)) {
      throw new Error(`Cannot unregister phase "${phaseId}" - phase "${id}" depends on it`);
    }
  }
  
  return PHASE_REGISTRY.delete(phaseId);
}

/**
 * Gets a phase definition by ID
 */
export function getPhaseDefinition(id: string): PhaseDefinition | undefined {
  return PHASE_REGISTRY.get(id);
}

/**
 * Gets all registered phases
 */
export function getAllPhases(): PhaseDefinition[] {
  return Array.from(PHASE_REGISTRY.values());
}

/**
 * Gets phases in topological order (respecting dependencies)
 */
export function getPhasesInOrder(): PhaseDefinition[] {
  const phases = getAllPhases();
  const visited = new Set<string>();
  const ordered: PhaseDefinition[] = [];
  
  function visit(phase: PhaseDefinition): void {
    if (visited.has(phase.id)) return;
    
    // Visit dependencies first
    for (const depId of phase.dependencies) {
      const dep = PHASE_REGISTRY.get(depId);
      if (dep) visit(dep);
    }
    
    visited.add(phase.id);
    ordered.push(phase);
  }
  
  for (const phase of phases) {
    visit(phase);
  }
  
  return ordered;
}

/**
 * Gets only required phases
 */
export function getRequiredPhases(): PhaseDefinition[] {
  return getAllPhases().filter((p) => p.isRequired);
}

/**
 * Gets only visible phases (not hidden)
 */
export function getVisiblePhases(): PhaseDefinition[] {
  return getAllPhases().filter((p) => !p.isHidden);
}

/**
 * Checks if adding a phase would create a dependency cycle
 */
function wouldCreateCycle(newPhase: PhaseDefinition): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(phaseId: string): boolean {
    if (recursionStack.has(phaseId)) return true;
    if (visited.has(phaseId)) return false;
    
    visited.add(phaseId);
    recursionStack.add(phaseId);
    
    const phase = PHASE_REGISTRY.get(phaseId);
    if (phase) {
      for (const dep of phase.dependencies) {
        if (hasCycle(dep)) return true;
      }
    }
    
    // Check if new phase's dependencies include itself (direct cycle)
    if (phaseId === newPhase.id) {
      for (const dep of newPhase.dependencies) {
        if (dep === newPhase.id || hasCycle(dep)) return true;
      }
    }
    
    recursionStack.delete(phaseId);
    return false;
  }
  
  return hasCycle(newPhase.id);
}

/**
 * Validates the entire phase registry for cycles
 */
export function validatePhaseRegistry(): { valid: boolean; cycles: string[][] } {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(phaseId: string, path: string[]): void {
    if (recursionStack.has(phaseId)) {
      // Found a cycle
      const cycleStart = path.indexOf(phaseId);
      cycles.push(path.slice(cycleStart).concat([phaseId]));
      return;
    }
    
    if (visited.has(phaseId)) return;
    
    visited.add(phaseId);
    recursionStack.add(phaseId);
    
    const phase = PHASE_REGISTRY.get(phaseId);
    if (phase) {
      for (const dep of phase.dependencies) {
        dfs(dep, [...path, phaseId]);
      }
    }
    
    recursionStack.delete(phaseId);
  }
  
  for (const phaseId of PHASE_REGISTRY.keys()) {
    if (!visited.has(phaseId)) {
      dfs(phaseId, []);
    }
  }
  
  return { valid: cycles.length === 0, cycles };
}

/**
 * Clears all registered phases (useful for testing)
 */
export function clearPhaseRegistry(): void {
  PHASE_REGISTRY.clear();
}

/**
 * Registers the default 8 phases
 */
export function registerDefaultPhases(): void {
  // Clear existing to avoid duplicates
  clearPhaseRegistry();
  
  // Register in dependency order
  registerPhase({
    id: 'constitution',
    name: 'Project Constitution',
    description: 'Immutable standards and constraints that govern the entire project',
    artifactType: 'constitution',
    sections: CONSTITUTION_SECTIONS,
    dependencies: [],
    isRequired: true,
    isHidden: false,
    validators: ['semantic-constitution'],
  });
  
  registerPhase({
    id: 'brief',
    name: 'Project Brief',
    description: 'High-level project overview and goals',
    artifactType: 'brief',
    sections: BRIEF_SECTIONS,
    dependencies: [],
    isRequired: true,
    isHidden: false,
    validators: ['completeness-checker'],
  });
  
  registerPhase({
    id: 'prd',
    name: 'Product Requirements Document',
    description: 'Detailed product requirements and specifications',
    artifactType: 'prd',
    sections: PRD_SECTIONS,
    dependencies: ['brief', 'constitution'],
    isRequired: true,
    isHidden: false,
    validators: ['completeness-checker'],
  });
  
  registerPhase({
    id: 'domainModel',
    name: 'Domain Model',
    description: 'Core domain entities and their relationships',
    artifactType: 'domainModel',
    sections: DOMAIN_MODEL_SECTIONS,
    dependencies: ['brief', 'constitution'],
    isRequired: true,
    isHidden: false,
    validators: ['completeness-checker'],
  });
  
  registerPhase({
    id: 'specs',
    name: 'Technical Specifications',
    description: 'Technical implementation details and API specifications',
    artifactType: 'spec',
    sections: SPECIFICATIONS_SECTIONS,
    dependencies: ['prd', 'domainModel', 'constitution'],
    isRequired: true,
    isHidden: false,
    validators: ['completeness-checker', 'api-schema-validator', 'security-coverage'],
  });
  
  registerPhase({
    id: 'stories',
    name: 'User Stories & Tasks',
    description: 'User stories with acceptance criteria and implementation tasks',
    artifactType: 'userStories',
    sections: USER_STORIES_SECTIONS,
    dependencies: ['specs', 'prd', 'constitution'],
    isRequired: true,
    isHidden: false,
    validators: ['completeness-checker'],
  });
  
  registerPhase({
    id: 'artifacts',
    name: 'Technical Artifacts',
    description: 'Generated code artifacts and implementation files',
    artifactType: 'techSpec',
    sections: ARTIFACTS_SECTIONS,
    dependencies: ['specs', 'stories'],
    isRequired: false,
    isHidden: false,
    validators: ['completeness-checker'],
  });
  
  registerPhase({
    id: 'handoff',
    name: 'Project Handoff',
    description: 'Final handoff package with all documentation and assets',
    artifactType: 'handoff',
    sections: HANDOFF_SECTIONS,
    dependencies: ['specs', 'stories', 'artifacts', 'constitution'],
    isRequired: true,
    isHidden: false,
    validators: ['completeness-checker'],
  });
}

// Auto-register default phases on module load
registerDefaultPhases();
