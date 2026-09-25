import {
  FileText,
  BookOpen,
  Target,
  Code,
  Layers,
  ClipboardList,
  Sparkles,
  Package,
  LucideIcon,
} from "lucide-react";

import { PhaseId, PHASE_ORDER } from "./workflow";

export interface PhaseConfig {
  id: PhaseId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  color: string;
  order: number;
}

const PHASE_DETAILS: Record<PhaseId, Omit<PhaseConfig, "id" | "order">> = {
  constitution: {
    label: "Constitution",
    shortLabel: "Constitution",
    icon: FileText,
    description: "Immutable truths and core constraints",
    color: "bg-red-500",
  },
  brief: {
    label: "Brief",
    shortLabel: "Brief",
    icon: BookOpen,
    description: "Define your project scope and requirements",
    color: "bg-blue-500",
  },
  prd: {
    label: "PRD",
    shortLabel: "PRD",
    icon: Target,
    description: "Formal product requirements and goals",
    color: "bg-indigo-500",
  },
  domainModel: {
    label: "Domain Model",
    shortLabel: "Domain",
    icon: Layers,
    description: "Entities, rules, and state transitions",
    color: "bg-teal-500",
  },
  specs: {
    label: "Spec & Architecture",
    shortLabel: "Specs",
    icon: Code,
    description: "Technical specifications and design",
    color: "bg-purple-500",
  },
  stories: {
    label: "Tasks/Stories",
    shortLabel: "Stories",
    icon: ClipboardList,
    description: "User stories and task breakdown",
    color: "bg-amber-500",
  },
  artifacts: {
    label: "Artifacts",
    shortLabel: "Artifacts",
    icon: Sparkles,
    description: "Generated assets and codebase models",
    color: "bg-green-500",
  },
  handoff: {
    label: "Handoff + ZIP",
    shortLabel: "Handoff",
    icon: Package,
    description: "Final deliverables and documentation",
    color: "bg-pink-500",
  },
};

export const PROJECT_PHASES: readonly PhaseConfig[] = PHASE_ORDER.map((id, index) => ({
  id,
  order: index,
  ...PHASE_DETAILS[id],
}));

export const PHASE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_PHASES.map((p) => [p.id, p.label])
);

export function getPhaseById(id: string): PhaseConfig | undefined {
  return PROJECT_PHASES.find((p) => p.id === id);
}

export function getPhaseIndex(id: string): number {
  return PROJECT_PHASES.findIndex((p) => p.id === id);
}

export function isValidPhaseId(id: string): boolean {
  return PROJECT_PHASES.some((p) => p.id === id);
}

export const PHASES = PROJECT_PHASES;
