/**
 * Export Utilities for SpecForge
 *
 * Provides formatters for exporting project artifacts in various formats:
 * - Markdown (existing)
 * - SKILL.md (for AI agents - Claude Code, Cursor, etc.)
 * - AGENTS.md (for project context)
 * - SIF (SpecForge Interchange Format - JSON)
 */

export {
  generateSkillMd,
  exportSkillMd,
  type SkillMdInput,
} from './skill-formatter';

export {
  generateAgentsMd,
  exportAgentsMd,
  type AgentsMdInput,
} from './agents-formatter';

export {
  exportToSif,
  validateSif,
  type ExportProject,
  type ExportPhase,
  type ExportArtifact,
  type ExportToSifOptions,
} from './sif-exporter';

export {
  SIF_SCHEMA_URL,
  SIF_SCHEMA_VERSION,
  type SpecForgeInterchangeFormat,
  type SifPhase,
  type SifArtifact,
  type ConformanceLevel,
} from './sif-schema';
