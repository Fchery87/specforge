/** `CHG-0007`: how a change is named everywhere a reader sees it. */
export function formatChangeId(changeNumber: number): string {
  return `CHG-${String(changeNumber).padStart(4, '0')}`;
}

export const CHANGE_KIND_WORDS = { feature: 'Feature change', bugfix: 'Bug fix' } as const;

export const CHANGE_STATUS_WORDS = { draft: 'Draft', applied: 'Applied', abandoned: 'Abandoned' } as const;

export type ChangeKind = keyof typeof CHANGE_KIND_WORDS;
export type ChangeStatus = keyof typeof CHANGE_STATUS_WORDS;
