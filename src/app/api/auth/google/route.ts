import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/google
 * Generates the Google OAuth2 authorization URL for the user to grant Drive access.
 * After authorization, the user will be redirected to Google OAuth2 Playground
 * where they can copy the authorization code and exchange it for a refresh token.
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
        '4. Add authorized redirect URI: https://developers.google.com/oauthplayground',
        '5. Copy the Client ID and Client Secret',
        '6. Set them as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars in Vercel',
      ],
    }, { status: 400 });
  }

  // Build the OAuth2 authorization URL
  const redirectUri = 'https://developers.google.com/oauthplayground';
  const scope = 'https://www.googleapis.com/auth/drive';

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return NextResponse.json({
    authUrl: authUrl.toString(),
    instructions: [
      '1. Open the authUrl in your browser',
      '2. Sign in with your Google account and grant Drive access',
      '3. You will be redirected to Google OAuth2 Playground',
      '4. Click "Exchange authorization code for tokens"',
      '5. Copy the refresh_token from the JSON response',
      '6. Set GOOGLE_REFRESH_TOKEN env var in Vercel with the refresh token value',
    ],
  });
}

/**
 * POST /api/auth/google
 * Exchange an authorization code for a refresh token.
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

    // Exchange code for tokens
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
