import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  createGitHubPkceChallenge,
  GITHUB_OAUTH_COOKIE_NAMES,
  getGitHubProjectRedirect,
} from '@/lib/github-oauth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  await auth.protect();

  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth is not configured' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || !('projectId' in body)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  }

  const projectId = body.projectId;
  if (typeof projectId !== 'string' || !getGitHubProjectRedirect(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
  }

  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createGitHubPkceChallenge(verifier);
  const callbackUrl = new URL('/api/github/callback', request.nextUrl.origin);
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authorizeUrl.searchParams.set('scope', 'repo read:user');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.json({ url: authorizeUrl.toString() });
  response.headers.set('Cache-Control', 'no-store');
  const cookieOptions = {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/api/github/callback',
    maxAge: 600,
  };
  response.cookies.set(GITHUB_OAUTH_COOKIE_NAMES.state, state, cookieOptions);
  response.cookies.set(
    GITHUB_OAUTH_COOKIE_NAMES.verifier,
    verifier,
    cookieOptions,
  );
  response.cookies.set(
    GITHUB_OAUTH_COOKIE_NAMES.projectId,
    projectId,
    cookieOptions,
  );

  return response;
}
