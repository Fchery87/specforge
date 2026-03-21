// lib/phase-config.ts
// Consolidated phase configuration shared across the application

import { 
  FileText, 
  Lightbulb, 
  BookOpen, 
  Code, 
  Settings, 
  Shield, 
  FileCheck, 
  Rocket,
  Layers,
  Target,
  ClipboardList,
  Package,
  Sparkles,
  LucideIcon 
} from "lucide-react";

export interface PhaseConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  order: number;
}

// Unified phase configuration - single source of truth
export const PHASES: readonly PhaseConfig[] = [
  {
    id: "constitution",
    label: "Constitution",
    shortLabel: "Constitution",
    icon: FileText,
    description: "Define the core vision, goals, and constraints of your project",
    order: 0,
  },
  {
    id: "context",
    label: "Context & Research",
    shortLabel: "Context",
    icon: Lightbulb,
    description: "Gather context, research, and background information",
    order: 1,
  },
  {
    id: "brief",
    label: "Brief",
    shortLabel: "Brief",
    icon: BookOpen,
    description: "Define your project scope and requirements",
    order: 1,
  },
  {
    id: "prd",
    label: "PRD",
    shortLabel: "PRD",
    icon: Target,
    description: "Formal product requirements and goals",
    order: 2,
  },
  {
    id: "specifications",
    label: "Specifications",
    shortLabel: "Specs",
    icon: Code,
    description: "Define detailed technical specifications",
    order: 2,
  },
  {
    id: "domainModel",
    label: "Domain Model",
    shortLabel: "Domain",
    icon: Layers,
    description: "Entities, rules, and state transitions",
    order: 3,
  },
  {
    id: "architecture",
    label: "Architecture",
    shortLabel: "Architecture",
    icon: Settings,
    description: "Design system architecture and component structure",
    order: 3,
  },
  {
    id: "stories",
    label: "Tasks/Stories",
    shortLabel: "Stories",
    icon: ClipboardList,
    description: "User stories and task breakdown",
    order: 4,
  },
  {
    id: "implementation",
    label: "Implementation",
    shortLabel: "Implementation",
    icon: Code,
    description: "Plan implementation details and development workflow",
    order: 4,
  },
  {
    id: "testing",
    label: "Testing Strategy",
    shortLabel: "Testing",
    icon: Shield,
    description: "Define testing approach and quality assurance",
    order: 5,
  },
  {
    id: "deployment",
    label: "Deployment",
    shortLabel: "Deployment",
    icon: FileCheck,
    description: "Plan deployment strategy and infrastructure",
    order: 6,
  },
  {
    id: "artifacts",
    label: "Artifacts",
    shortLabel: "Artifacts",
    icon: Sparkles,
    description: "Generated assets and codebase models",
    order: 6,
  },
  {
    id: "handoff",
    label: "Handoff + ZIP",
    shortLabel: "Handoff",
    icon: Package,
    description: "Final deliverables and documentation",
    order: 7,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    shortLabel: "Maintenance",
    icon: Rocket,
    description: "Define ongoing maintenance and support plans",
    order: 7,
  },
] as const;

// Create a lookup map for O(1) access
export const PHASE_CONFIG: Record<string, PhaseConfig> = Object.fromEntries(
  PHASES.map((p) => [p.id, p])
);

// Legacy phases array for backward compatibility with project page
// This maintains the 8-phase workflow structure
export const PROJECT_PHASES: readonly PhaseConfig[] = [
  {
    id: "constitution",
    label: "Constitution",
    shortLabel: "Constitution",
    icon: FileText,
    description: "Immutable truths and core constraints",
    order: 0,
  },
  {
    id: "brief",
    label: "Brief",
    shortLabel: "Brief",
    icon: BookOpen,
    description: "Define your project scope and requirements",
    order: 1,
  },
  {
    id: "prd",
    label: "PRD",
    shortLabel: "PRD",
    icon: Target,
    description: "Formal product requirements and goals",
    order: 2,
  },
  {
    id: "domainModel",
    label: "Domain Model",
    shortLabel: "Domain",
    icon: Layers,
    description: "Entities, rules, and state transitions",
    order: 3,
  },
  {
    id: "specs",
    label: "Spec & Architecture",
    shortLabel: "Specs",
    icon: Code,
    description: "Technical specifications and design",
    order: 4,
  },
  {
    id: "stories",
    label: "Tasks/Stories",
    shortLabel: "Stories",
    icon: ClipboardList,
    description: "User stories and task breakdown",
    order: 5,
  },
  {
    id: "artifacts",
    label: "Artifacts",
    shortLabel: "Artifacts",
    icon: Sparkles,
    description: "Generated assets and codebase models",
    order: 6,
  },
  {
    id: "handoff",
    label: "Handoff + ZIP",
    shortLabel: "Handoff",
    icon: Package,
    description: "Final deliverables and documentation",
    order: 7,
  },
] as const;

// Helper functions
export function getPhaseById(id: string): PhaseConfig | undefined {
  return PHASE_CONFIG[id];
}

export function getProjectPhaseById(id: string): PhaseConfig | undefined {
  return PROJECT_PHASES.find((p) => p.id === id);
}

export function getPhaseIndex(id: string): number {
  return PHASES.findIndex((p) => p.id === id);
}

export function getProjectPhaseIndex(id: string): number {
  return PROJECT_PHASES.findIndex((p) => p.id === id);
}

export function isValidPhaseId(id: string): boolean {
  return id in PHASE_CONFIG;
}

export function isValidProjectPhaseId(id: string): boolean {
  return PROJECT_PHASES.some((p) => p.id === id);
}
