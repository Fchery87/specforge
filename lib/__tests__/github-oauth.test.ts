import { describe, expect, it } from 'vitest';
import {
  createGitHubPkceChallenge,
  getGitHubProjectRedirect,
  isGitHubTokenResponse,
  matchesGitHubOAuthState,
} from '../github-oauth';

describe('GitHub OAuth helpers', () => {
  it('generates the S256 PKCE challenge for a verifier', () => {
    expect(
      createGitHubPkceChallenge(
        'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      ),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('accepts only an exact OAuth state match', () => {
    expect(matchesGitHubOAuthState('state-value', 'state-value')).toBe(true);
    expect(matchesGitHubOAuthState('attacker-value', 'state-value')).toBe(false);
    expect(matchesGitHubOAuthState(null, 'state-value')).toBe(false);
    expect(matchesGitHubOAuthState('state-value', undefined)).toBe(false);
  });

  it('builds only project-local callback redirects', () => {
    expect(getGitHubProjectRedirect('abc_123')).toBe('/project/abc_123');
    expect(getGitHubProjectRedirect('../dashboard')).toBeNull();
  });

  it('validates the OAuth token exchange response at the boundary', () => {
    expect(isGitHubTokenResponse({ access_token: 'token' })).toBe(true);
    expect(isGitHubTokenResponse({ access_token: '' })).toBe(false);
    expect(isGitHubTokenResponse({ error: 'bad_verification_code' })).toBe(false);
    expect(isGitHubTokenResponse(null)).toBe(false);
  });
});
