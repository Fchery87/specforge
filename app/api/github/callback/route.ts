import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';
import { getRequiredEncryptionKey } from '@/lib/encryption-key';

const ENCRYPTION_KEY = getRequiredEncryptionKey();

/**
 * GitHub OAuth callback handler
 * Exchanges the authorization code for an access token and stores it encrypted
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Contains redirect URL and project info
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Unknown error';
    console.error('[GitHub OAuth] Error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/dashboard?error=github_${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?error=missing_code', request.url)
    );
  }

  try {
    // Exchange code for access token
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth credentials not configured');
    }

    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error_description}`);
    }

    const accessToken = tokenData.access_token;

    // Parse state to get redirect info
    let redirectUrl = '/dashboard';
    let projectId: string | null = null;
    
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        redirectUrl = stateData.redirect || '/dashboard';
        projectId = stateData.projectId || null;
      } catch {
        // Invalid state, use defaults
      }
    }

    // Encrypt the access token
    const encrypted = encrypt(accessToken, ENCRYPTION_KEY);
    const encryptedJson = JSON.stringify(encrypted);

    // Store the encrypted token in Convex via API
    // The client will need to call a mutation to store this
    // For now, we redirect with the encrypted token (safe since it's encrypted)
    const redirectWithToken = new URL(redirectUrl, request.url);
    redirectWithToken.searchParams.set('github_token', Buffer.from(encryptedJson).toString('base64'));
    if (projectId) {
      redirectWithToken.searchParams.set('project_id', projectId);
    }

    return NextResponse.redirect(redirectWithToken);

  } catch (error) {
    console.error('[GitHub OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard?error=oauth_failed', request.url)
    );
  }
}
