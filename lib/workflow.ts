export type PhaseId =
  | 'constitution'
  | 'brief'
  | 'prd'
  | 'domainModel'
  | 'specs'
  | 'stories'
  | 'artifacts'
  | 'handoff';

export const PHASE_ORDER: readonly PhaseId[] = [
  'constitution',
  'brief',
  'prd',
  'domainModel',
  'specs',
  'stories',
  'artifacts',
  'handoff',
] as const;

export type StageId = 'requirements' | 'design' | 'tasks';

export interface WorkflowStage {
  id: StageId;
  label: string;
  summary: string;
  phaseIds: readonly PhaseId[];
}

export const WORKFLOW_STAGES: readonly WorkflowStage[] = [
  {
    id: 'requirements',
    label: 'Requirements',
    summary: 'What to build and why',
    phaseIds: ['brief', 'prd'],
  },
  {
    id: 'design',
    label: 'Design',
    summary: 'System architecture and data contracts',
    phaseIds: ['domainModel', 'specs', 'artifacts'],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    summary: 'Implementation steps and stories',
    phaseIds: ['stories'],
  },
] as const;

export const RULES_PHASE: PhaseId = 'constitution';
export const EXPORT_PHASE: PhaseId = 'handoff';

export interface OutlineGroup {
  label: string;
  phaseIds: readonly PhaseId[];
}

/**
 * Every phase in reading order, grouped as the reader meets them: the rules, each stage, then the
 * handoff. Not `PHASE_ORDER`, which is storage order and puts Tasks between two Design phases. The
 * project sidebar and the phase ledger both draw from this, so they cannot list phases differently.
 */
export const PROJECT_OUTLINE: readonly OutlineGroup[] = [
  { label: 'Rules', phaseIds: [RULES_PHASE] },
  ...WORKFLOW_STAGES.map((stage) => ({ label: stage.label, phaseIds: stage.phaseIds })),
  { label: 'Handoff', phaseIds: [EXPORT_PHASE] },
];

/**
 * The display name of each phase. One definition, because a phase renamed in one place and not
 * another shows the user two names for the same thing. These are the names from the guided
 * workflow spec: the phase is `specs`, the user reads "Architecture".
 */
export const PHASE_LABELS: Record<PhaseId, string> = {
  constitution: 'Project Rules',
  brief: 'Brief',
  prd: 'PRD',
  domainModel: 'Domain Model',
  specs: 'Architecture',
  stories: 'Tasks',
  artifacts: 'Schemas',
  handoff: 'Export',
};

/** Label lookup that tolerates a phase id the caller has not narrowed to `PhaseId`. */
export function phaseLabel(phaseId: string): string {
  return PHASE_LABELS[phaseId as PhaseId] ?? phaseId;
}

/**
 * The stage a phase belongs to, or undefined for a phase outside every stage.
 *
 * `constitution` and `handoff` are those two: the rules phase precedes the workflow and the export
 * phase follows it, so neither is measured as part of a stage. Derived from `WORKFLOW_STAGES` rather
 * than a second table, so a phase moved between stages moves here in the same edit.
 */
export function stageIdForPhase(phaseId: string): StageId | undefined {
  return WORKFLOW_STAGES.find((stage) => stage.phaseIds.includes(phaseId as PhaseId))?.id;
}

export type ProjectMode = 'quick' | 'full' | 'backend';

export interface ModePolicy {
  label: string;
  description: string;
  reviewAfter: readonly StageId[];
  skippedPhases: readonly PhaseId[];
}

export const MODE_POLICIES: Record<ProjectMode, ModePolicy> = {
  quick: {
    label: 'Lite',
    description: 'For a feature or a fix. Skips the domain model and schemas, and generates without review stops.',
    reviewAfter: [],
    skippedPhases: ['domainModel', 'artifacts'],
  },
  full: {
    label: 'Full',
    description: 'For a new product. Every phase, with a review after each stage.',
    reviewAfter: ['requirements', 'design', 'tasks'],
    skippedPhases: [],
  },
  backend: {
    label: 'Backend',
    description: 'For services and APIs. Skips the brief, starts from the PRD, and reviews after each stage.',
    reviewAfter: ['requirements', 'design', 'tasks'],
    skippedPhases: ['brief'],
  },
};

export type StageStatus = 'not-started' | 'in-progress' | 'generating' | 'ready' | 'error';

export type NextAction =
  | { kind: 'answer'; phaseId: PhaseId }
  | { kind: 'generate'; phaseId: PhaseId }
  | { kind: 'review'; stageId: StageId }
  | { kind: 'continue'; stageId: StageId }
  | { kind: 'export' };

export type PhaseRawStatus = 'pending' | 'generating' | 'ready' | 'error' | 'skipped';

export const PHASE_STATUS_WORDS: Record<PhaseRawStatus, string> = {
  pending: 'Not started',
  generating: 'Generating',
  ready: 'Ready',
  error: 'Error',
  skipped: 'Skipped',
};

export interface PhaseQuestion {
  id?: string;
  text?: string;
  answer?: string;
  required?: boolean;
}

export interface PhaseInfo {
  status: PhaseRawStatus;
  questions?: ReadonlyArray<PhaseQuestion>;
}

export type PhaseStatusMap =
  | Record<string, PhaseInfo | PhaseRawStatus>
  | Map<string, PhaseInfo | PhaseRawStatus>
  | ReadonlyArray<{
      phaseId: string;
      status: PhaseRawStatus;
      questions?: ReadonlyArray<PhaseQuestion>;
    }>;

function getPhaseInfo(
  phases: PhaseStatusMap,
  phaseId: PhaseId,
): PhaseInfo | undefined {
  if (Array.isArray(phases)) {
    const item = phases.find((p) => p.phaseId === phaseId);
    if (!item) return undefined;
    return {
      status: item.status,
      questions: item.questions,
    };
  }

  if (phases instanceof Map) {
    const val = phases.get(phaseId);
    if (!val) return undefined;
    if (typeof val === 'string') {
      return { status: val };
    }
    return val;
  }

  if (phases && typeof phases === 'object') {
    const val = (phases as Record<string, PhaseInfo | PhaseRawStatus>)[phaseId];
    if (!val) return undefined;
    if (typeof val === 'string') {
      return { status: val };
    }
    return val;
  }

  return undefined;
}

function isPhaseSkipped(
  phaseId: PhaseId,
  phases: PhaseStatusMap,
  skipped: readonly (PhaseId | string)[],
): boolean {
  if (skipped.includes(phaseId)) return true;
  const info = getPhaseInfo(phases, phaseId);
  return info?.status === 'skipped';
}

/**
 * A phase's status, with the skip list applied and a missing record read as `pending`. The one lookup
 * every surface uses, so the band, the ledger and the next action cannot disagree about a phase.
 */
export function phaseState(
  phases: PhaseStatusMap,
  skipped: readonly (PhaseId | string)[],
  phaseId: PhaseId,
): PhaseRawStatus {
  if (isPhaseSkipped(phaseId, phases, skipped)) return 'skipped';
  return getPhaseInfo(phases, phaseId)?.status ?? 'pending';
}

/**
 * Where a stage's link goes: its first enabled phase that is not ready, or its first enabled phase
 * once all of them are, or its first phase when every phase is skipped.
 */
export function stageTargetPhase(
  stage: WorkflowStage,
  phases: PhaseStatusMap,
  skipped: readonly (PhaseId | string)[],
): PhaseId {
  const enabled = stage.phaseIds.filter((id) => !isPhaseSkipped(id, phases, skipped));
  if (enabled.length === 0) return stage.phaseIds[0];
  return enabled.find((id) => getPhaseInfo(phases, id)?.status !== 'ready') ?? enabled[0];
}

export function stageStatus(
  stage: WorkflowStage,
  phases: PhaseStatusMap,
  skipped: readonly (PhaseId | string)[],
): StageStatus {
  const enabledPhaseIds = stage.phaseIds.filter(
    (id) => !isPhaseSkipped(id, phases, skipped),
  );

  if (enabledPhaseIds.length === 0) {
    return 'ready';
  }

  const enabledInfos = enabledPhaseIds.map((id) => getPhaseInfo(phases, id));

  if (enabledInfos.some((info) => info?.status === 'error')) {
    return 'error';
  }

  if (enabledInfos.some((info) => info?.status === 'generating')) {
    return 'generating';
  }

  if (enabledInfos.every((info) => info?.status === 'ready')) {
    return 'ready';
  }

  const hasStarted = enabledInfos.some((info) => {
    if (!info) return false;
    if (info.status === 'ready') return true;
    if (info.status !== 'pending') return true;
    return (
      info.questions?.some(
        (q) => typeof q.answer === 'string' && q.answer.trim().length > 0,
      ) ?? false
    );
  });

  return hasStarted ? 'in-progress' : 'not-started';
}

/** Where the reader is, given the next action: the phase that action works on. */
export function currentPhaseFor(
  action: NextAction,
  phases: PhaseStatusMap,
  skipped: readonly (PhaseId | string)[],
): PhaseId {
  switch (action.kind) {
    case 'answer':
    case 'generate':
      return action.phaseId;
    case 'review':
    case 'continue': {
      const stage = WORKFLOW_STAGES.find((candidate) => candidate.id === action.stageId);
      return stage ? stageTargetPhase(stage, phases, skipped) : EXPORT_PHASE;
    }
    case 'export':
      return EXPORT_PHASE;
  }
}

export function nextAction(
  phases: PhaseStatusMap,
  skipped: readonly (PhaseId | string)[],
  mode: ProjectMode,
): NextAction {
  // If all enabled phases across all WORKFLOW_STAGES are ready, return { kind: 'export' }.
  const allEnabledPhasesReady = WORKFLOW_STAGES.every((stage) => {
    const enabled = stage.phaseIds.filter(
      (id) => !isPhaseSkipped(id, phases, skipped),
    );
    return enabled.every((id) => getPhaseInfo(phases, id)?.status === 'ready');
  });

  if (allEnabledPhasesReady) {
    return { kind: 'export' };
  }

  // Otherwise, find the first stage in WORKFLOW_STAGES that is not ready.
  const stageIndex = WORKFLOW_STAGES.findIndex(
    (stage) => stageStatus(stage, phases, skipped) !== 'ready',
  );

  if (stageIndex === -1) {
    return { kind: 'export' };
  }

  const stage = WORKFLOW_STAGES[stageIndex];
  const currentStageStatus = stageStatus(stage, phases, skipped);

  // If stageIndex > 0 and the stage is 'not-started', and MODE_POLICIES[mode].reviewAfter.includes(WORKFLOW_STAGES[stageIndex - 1].id), return { kind: 'continue', stageId: stage.id }.
  if (
    stageIndex > 0 &&
    currentStageStatus === 'not-started' &&
    MODE_POLICIES[mode].reviewAfter.includes(WORKFLOW_STAGES[stageIndex - 1].id)
  ) {
    return { kind: 'continue', stageId: stage.id };
  }

  // Inside the stage, find the first enabled phase that is not 'ready'.
  const enabledPhaseIds = stage.phaseIds.filter(
    (id) => !isPhaseSkipped(id, phases, skipped),
  );
  const activePhaseId = enabledPhaseIds.find(
    (id) => getPhaseInfo(phases, id)?.status !== 'ready',
  );

  if (!activePhaseId) {
    return { kind: 'export' };
  }

  const phaseInfo = getPhaseInfo(phases, activePhaseId);
  const status = phaseInfo?.status ?? 'pending';
  const questions = phaseInfo?.questions;

  // If the phase is pending and has questions where all required questions are answered (questions.length > 0 && questions.every(q => !q.required || (q.answer && q.answer.trim().length > 0))), return { kind: 'generate', phaseId }.
  const hasAllRequiredAnswers =
    Boolean(questions && questions.length > 0) &&
    questions!.every(
      (q) => !q.required || (Boolean(q.answer) && q.answer!.trim().length > 0),
    );

  if (status === 'pending' && hasAllRequiredAnswers) {
    return { kind: 'generate', phaseId: activePhaseId };
  }

  // Otherwise, return { kind: 'answer', phaseId }.
  return { kind: 'answer', phaseId: activePhaseId };
}
