/**
 * Export Utilities for SpecForge
 *
 * Provides formatters for exporting project artifacts in various formats:
 * - Markdown (existing)
 * - SKILL.md (for AI agents - Claude Code, Cursor, etc.)
 * - AGENTS.md (for project context)
 * - JSON (existing)
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
