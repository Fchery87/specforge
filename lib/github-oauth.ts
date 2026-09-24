import { createHash, timingSafeEqual } from 'node:crypto';

export const GITHUB_OAUTH_COOKIE_NAMES = {
  state: 'specforge_github_oauth_state',
  verifier: 'specforge_github_oauth_verifier',
  projectId: 'specforge_github_oauth_project',
} as const;

export function createGitHubPkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function matchesGitHubOAuthState(
  returnedState: string | null,
  expectedState: string | undefined,
): boolean {
  if (!returnedState || !expectedState) return false;

  const returned = Buffer.from(returnedState);
  const expected = Buffer.from(expectedState);
  return (
    returned.length === expected.length && timingSafeEqual(returned, expected)
  );
}

export function getGitHubProjectRedirect(projectId: string): string | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) return null;
  return `/project/${projectId}`;
}

export function isGitHubTokenResponse(
  value: unknown,
): value is { access_token: string; error?: string } {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'access_token' in value &&
    typeof value.access_token === 'string' &&
    value.access_token.length > 0
  );
}
