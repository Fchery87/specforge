/** `CHG-0007`: how a change is named everywhere a reader sees it. */
export function formatChangeId(changeNumber: number): string {
  return `CHG-${String(changeNumber).padStart(4, '0')}`;
}
