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

export type ProjectMode = 'quick' | 'full' | 'backend';

export interface ModePolicy {
  label: string;
  reviewAfter: readonly StageId[];
  skippedPhases: readonly PhaseId[];
}

export const MODE_POLICIES: Record<ProjectMode, ModePolicy> = {
  quick: {
    label: 'Lite',
    reviewAfter: [],
    skippedPhases: ['domainModel', 'artifacts'],
  },
  full: {
    label: 'Full',
    reviewAfter: ['requirements', 'design', 'tasks'],
    skippedPhases: [],
  },
  backend: {
    label: 'Backend',
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
  skipped: readonly PhaseId[],
): boolean {
  if (skipped.includes(phaseId)) return true;
  const info = getPhaseInfo(phases, phaseId);
  return info?.status === 'skipped';
}

export function stageStatus(
  stage: WorkflowStage,
  phases: PhaseStatusMap,
  skipped: readonly PhaseId[],
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

export function nextAction(
  phases: PhaseStatusMap,
  skipped: readonly PhaseId[],
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
