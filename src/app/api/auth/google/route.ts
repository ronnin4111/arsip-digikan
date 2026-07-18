import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/google
 * Generates the Google OAuth2 authorization URL.
 * Supports TWO flows:
 *
 * 1. Built-in callback (RECOMMENDED): Uses the app's own callback URL
 *    - redirect=app query parameter
 *    - The callback URL is automatically determined from the request origin
 *
 * 2. OAuth2 Playground (ALTERNATIVE): Uses Google's OAuth Playground
 *    - redirect=playground query parameter (or default)
 *    - User copies the auth code manually and pastes it in the dashboard
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars are not set.',
      instructions: [
        '1. Go to Google Cloud Console → APIs & Services → Credentials',
        '2. Click "Create Credentials" → "OAuth client ID"',
        '3. Application type: "Web application"',
        '4. Add authorized redirect URIs (see below)',
        '5. Copy the Client ID and Client Secret',
        '6. Set them as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars in Vercel',
      ],
    }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const redirectType = searchParams.get('redirect') || 'app';

  let redirectUri: string;

  if (redirectType === 'playground') {
    // Use OAuth2 Playground
    redirectUri = 'https://developers.google.com/oauthplayground';
  } else {
    // Use built-in callback
    const origin = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (origin.includes('localhost') ? 'http' : 'https');
    redirectUri = `${protocol}://${origin}/api/auth/google/callback`;
  }

  // Build the OAuth2 authorization URL
  const scope = 'https://www.googleapis.com/auth/drive';

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  if (redirectType === 'playground') {
    return NextResponse.json({
      authUrl: authUrl.toString(),
      redirectUri,
      instructions: [
        '1. Open the authUrl in your browser',
        '2. Sign in with your Google account and grant Drive access',
        '3. You will be redirected to Google OAuth2 Playground',
        '4. Copy the authorization code from the URL (code= parameter)',
        '5. Use the POST endpoint to exchange the code for a refresh token',
      ],
    });
  }

  // For built-in flow, redirect directly to Google
  return NextResponse.redirect(authUrl.toString());
}

/**
 * POST /api/auth/google
 * Exchange an authorization code for a refresh token.
 * Used when the user manually pastes the code from OAuth2 Playground.
 */
export async function POST(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'OAuth2 not configured' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    // Exchange code for tokens using Playground redirect URI
    const redirectUri = 'https://developers.google.com/oauthplayground';
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      return NextResponse.json({
        error: 'No refresh token received. Make sure to use prompt=consent when authorizing.',
        hint: 'Revoke access at https://myaccount.google.com/permissions and try again.',
        tokens,
      }, { status: 400 });
    }

    return NextResponse.json({
      refresh_token: tokens.refresh_token,
      message: 'Set this refresh_token as GOOGLE_REFRESH_TOKEN env var in Vercel, then redeploy.',
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json({ error: 'Failed to exchange authorization code' }, { status: 500 });
  }
}
