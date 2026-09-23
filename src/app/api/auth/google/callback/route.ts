import { NextRequest, NextResponse } from 'next/server';
import { setSetting, invalidateDriveCache } from '@/lib/google-drive';
import { logAction } from '@/lib/log';

/**
 * GET /api/auth/google/callback
 * Handles the OAuth2 callback from Google.
 *  1. Exchanges the authorization code for tokens.
 *  2. Persists the refresh token to the `settings` table (key=GOOGLE_REFRESH_TOKEN).
 *  3. Invalidates the in-memory Drive cache so the next request picks up the new token.
 *  4. Shows a friendly success page with a "Back to Dashboard" link.
 *
 * Notes:
 * - Access token is NOT persisted (it expires in 1h). The refresh token is what we need.
 * - The refresh token is rotated by Google each time the user re-authorizes with prompt=consent;
 *   the previous one is automatically invalidated. Our DB upsert handles this cleanly.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  // Optional: admin can pre-authenticate by passing their app JWT in `state`
  // so we can attribute the connection to a specific user in the log.
  const state = searchParams.get('state') || '';

  if (error) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family:system-ui;max-width:600px;margin:60px auto;padding:20px;">
        <h1 style="color:#dc2626;">OAuth Authorization Gagal</h1>
        <p>Google mengembalikan error: <strong>${error}</strong></p>
        <p>Pastikan OAuth consent screen dikonfigurasi dengan benar:</p>
        <ol>
          <li>Buka Google Cloud Console → APIs &amp; Services → OAuth consent screen</li>
          <li>Set UserType ke <strong>External</strong></li>
          <li>Tambahkan email Gmail Anda sebagai <strong>Test User</strong></li>
          <li>Pastikan Google Drive API sudah di-enable</li>
        </ol>
        <p><a href="/" style="color:#2563eb;">Kembali ke Dashboard</a></p>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (!code) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family:system-ui;max-width:600px;margin:60px auto;padding:20px;">
        <h1 style="color:#dc2626;">Kode otorisasi tidak ditemukan</h1>
        <p><a href="/" style="color:#2563eb;">Kembali ke Dashboard</a></p>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (!clientId || !clientSecret) {
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head><title>Configuration Error</title></head>
      <body style="font-family:system-ui;max-width:600px;margin:60px auto;padding:20px;">
        <h1 style="color:#dc2626;">OAuth2 Belum Dikonfigurasi</h1>
        <p>GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diset di environment variables.</p>
        <p><a href="/" style="color:#2563eb;">Kembali ke Dashboard</a></p>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  try {
    // Determine the redirect URI based on the request origin
    const origin = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (origin.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${origin}/api/auth/google/callback`;

    // Exchange code for tokens
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
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head><title>Token Error</title></head>
        <body style="font-family:system-ui;max-width:600px;margin:60px auto;padding:20px;">
          <h1 style="color:#dc2626;">Refresh Token Tidak Ditemukan</h1>
          <p>Google tidak mengembalikan refresh token. Ini bisa terjadi jika:</p>
          <ul>
            <li>Anda sudah pernah mengotorisasi sebelumnya tanpa <code>prompt=consent</code></li>
            <li>Coba revoke akses di <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a> lalu coba lagi</li>
          </ul>
          <details>
            <summary>Detail Response (klik untuk melihat)</summary>
            <pre style="background:#f1f5f9;padding:12px;border-radius:6px;overflow-x:auto;font-size:13px;">${JSON.stringify(tokens, null, 2)}</pre>
          </details>
          <p><a href="/" style="color:#2563eb;">Kembali ke Dashboard</a></p>
        </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // ─── Persist refresh token to DB ──────────────────────────────────────
    const refreshToken = tokens.refresh_token as string;
    await setSetting('GOOGLE_REFRESH_TOKEN', refreshToken);
    invalidateDriveCache();

    // Best-effort audit log (don't fail if log write fails)
    try {
      await logAction({
        action: 'GOOGLE_DRIVE_CONNECT',
        detail: 'Google Drive OAuth2 berhasil dikoneksikan via dashboard. Refresh token disimpan ke tabel settings.',
      });
    } catch {
      // ignore log errors
    }

    // Masked preview for the success page
    const maskedToken = refreshToken.substring(0, 10) + '...' + refreshToken.substring(refreshToken.length - 5);

    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Terhubung!</title>
        <style>
          body { font-family: system-ui; max-width: 700px; margin: 40px auto; padding: 20px; }
          .success { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 24px; margin: 20px 0; }
          .step { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 12px 0; border-radius: 0 8px 8px 0; }
          .step-num { display: inline-block; background: #3b82f6; color: white; width: 24px; height: 24px; text-align: center; line-height: 24px; border-radius: 50%; font-size: 12px; font-weight: bold; margin-right: 8px; }
          h1 { color: #16a34a; }
          .token-preview { background: #1e293b; color: #a5f3fc; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 12px; word-break: break-all; }
          .btn { display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; margin-top: 16px; }
          .btn:hover { background: #1d4ed8; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>&#10003; Google Drive Berhasil Terhubung!</h1>
          <p>Refresh token telah <strong>disimpan otomatis ke database</strong>. Tidak perlu update env var atau redeploy.</p>
          <p class="token-preview">${maskedToken}</p>
        </div>

        <div class="step">
          <span class="step-num">1</span>
          <strong>Klik tombol di bawah</strong> untuk kembali ke Dashboard dan mulai upload file.
        </div>

        <a href="/" class="btn">Kembali ke Dashboard</a>

        <script>
          // Auto-redirect after 3 seconds so the user doesn't have to click
          setTimeout(() => { window.location.href = '/'; }, 3000);
        </script>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    console.error('Token exchange error:', error);
    const err = error as { message?: string };
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family:system-ui;max-width:600px;margin:60px auto;padding:20px;">
        <h1 style="color:#dc2626;">Gagal Menukar Kode Otorisasi</h1>
        <p>Error: ${err.message || 'Unknown error'}</p>
        <p><a href="/" style="color:#2563eb;">Kembali ke Dashboard</a></p>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}
