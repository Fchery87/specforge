export const ACCOUNT_SUSPENDED = 'Account suspended';

export function accountAccessError(suspendedAt: number | undefined): string | null {
  return suspendedAt === undefined ? null : ACCOUNT_SUSPENDED;
}
