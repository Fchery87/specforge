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
