import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { auth } from '@clerk/nextjs/server';
import {
  GITHUB_OAUTH_COOKIE_NAMES,
  getGitHubProjectRedirect,
  isGitHubTokenResponse,
  matchesGitHubOAuthState,
} from '@/lib/github-oauth';

export const dynamic = 'force-dynamic';

function redirectAndClearCookies(
  request: NextRequest,
  projectId: string | null,
  error?: string,
) {
  const projectPath = projectId ? getGitHubProjectRedirect(projectId) : null;
  const destination = new URL(projectPath ?? '/dashboard', request.nextUrl.origin);
  if (error) destination.searchParams.set('error', error);

  const response = NextResponse.redirect(destination);
  response.headers.set('Cache-Control', 'no-store');
  const cookieOptions = {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/api/github/callback',
    maxAge: 0,
  };
  response.cookies.set(GITHUB_OAUTH_COOKIE_NAMES.state, '', cookieOptions);
  response.cookies.set(GITHUB_OAUTH_COOKIE_NAMES.verifier, '', cookieOptions);
  response.cookies.set(GITHUB_OAUTH_COOKIE_NAMES.projectId, '', cookieOptions);
  return response;
}

export async function GET(request: NextRequest) {
  await auth.protect();

  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state');
  const expectedState = request.cookies.get(
    GITHUB_OAUTH_COOKIE_NAMES.state,
  )?.value;
  const verifier = request.cookies.get(
    GITHUB_OAUTH_COOKIE_NAMES.verifier,
  )?.value;
  const projectId = request.cookies.get(
    GITHUB_OAUTH_COOKIE_NAMES.projectId,
  )?.value ?? null;
  const projectPath = projectId ? getGitHubProjectRedirect(projectId) : null;

  if (
    !projectPath ||
    !verifier ||
    !matchesGitHubOAuthState(state, expectedState)
  ) {
    return redirectAndClearCookies(request, null, 'github_state_invalid');
  }

  const githubError = searchParams.get('error');
  if (githubError) {
    return redirectAndClearCookies(request, projectId, 'github_authorization_denied');
  }

  const code = searchParams.get('code');
  if (!code) {
    return redirectAndClearCookies(request, projectId, 'github_code_missing');
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!clientId || !clientSecret || !convexUrl) {
      throw new Error('OAuth or backend configuration is missing');
    }

    const callbackUrl = new URL('/api/github/callback', request.nextUrl.origin);
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: verifier,
          redirect_uri: callbackUrl.toString(),
        }),
        cache: 'no-store',
      },
    );
    if (!tokenResponse.ok) {
      throw new Error(`GitHub token exchange failed (${tokenResponse.status})`);
    }

    const tokenData: unknown = await tokenResponse.json();
    if (!isGitHubTokenResponse(tokenData)) {
      throw new Error('GitHub did not return an access token');
    }

    const { getToken } = await auth();
    const convexToken = await getToken({ template: 'convex' });
    if (!convexToken) throw new Error('Convex authentication token is unavailable');

    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);
    await convex.action(api.actions.githubAuth.saveGitHubToken, {
      accessToken: tokenData.access_token,
    });

    return redirectAndClearCookies(request, projectId);
  } catch (error) {
    console.error(
      '[GitHub OAuth] Callback failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return redirectAndClearCookies(request, projectId, 'github_oauth_failed');
  }
}
