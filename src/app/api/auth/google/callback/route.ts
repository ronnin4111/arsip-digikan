import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/auth/google/callback
 * Handles the OAuth2 callback from Google.
 * Exchanges the authorization code for tokens and displays the refresh token.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

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
          <li>Set User Type ke <strong>External</strong></li>
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

    // Success! Show the refresh token
    const refreshToken = tokens.refresh_token;
    const maskedToken = refreshToken.substring(0, 10) + '...' + refreshToken.substring(refreshToken.length - 5);

    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Terhubung!</title>
        <style>
          body { font-family: system-ui; max-width: 700px; margin: 40px auto; padding: 20px; }
          .success { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 24px; margin: 20px 0; }
          .token-box { background: #1e293b; color: #a5f3fc; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; word-break: break-all; position: relative; }
          .copy-btn { position: absolute; top: 8px; right: 8px; background: #475569; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; }
          .copy-btn:hover { background: #64748b; }
          .step { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 12px 0; border-radius: 0 8px 8px 0; }
          .step-num { display: inline-block; background: #3b82f6; color: white; width: 24px; height: 24px; text-align: center; line-height: 24px; border-radius: 50%; font-size: 12px; font-weight: bold; margin-right: 8px; }
          h1 { color: #16a34a; }
          .warning { background: #fefce8; border: 1px solid #eab308; border-radius: 8px; padding: 12px 16px; margin: 12px 0; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>&#10003; Google Drive Berhasil Terhubung!</h1>
          <p>Authorization berhasil. Sekarang Anda perlu menyimpan <strong>Refresh Token</strong> ke environment variables.</p>
        </div>

        <h3>Refresh Token Anda:</h3>
        <div class="token-box" id="token-box">
          <button class="copy-btn" onclick="copyToken()">Copy</button>
          <span id="token-text">${refreshToken}</span>
        </div>

        <div class="warning">
          <strong>&#9888; Penting:</strong> Simpan refresh token ini segera. Token ini hanya ditampilkan sekali!
        </div>

        <h3>Langkah Selanjutnya:</h3>

        <div class="step">
          <span class="step-num">1</span>
          <strong>Buka Vercel Dashboard</strong> → Project Anda → Settings → Environment Variables
        </div>

        <div class="step">
          <span class="step-num">2</span>
          <strong>Tambahkan variable baru:</strong><br>
          Name: <code>GOOGLE_REFRESH_TOKEN</code><br>
          Value: <em>(paste refresh token di atas)</em>
        </div>

        <div class="step">
          <span class="step-num">3</span>
          <strong>Redeploy</strong> project Anda di Vercel agar variable baru terbaca
        </div>

        <div class="step">
          <span class="step-num">4</span>
          Setelah redeploy, buka dashboard dan upload file untuk memastikan file tersimpan di Google Drive Anda
        </div>

        <p style="margin-top:24px;"><a href="/" style="color:#2563eb;font-size:16px;">&#8592; Kembali ke Dashboard</a></p>

        <script>
          function copyToken() {
            const token = document.getElementById('token-text').textContent;
            navigator.clipboard.writeText(token).then(() => {
              const btn = document.querySelector('.copy-btn');
              btn.textContent = 'Copied!';
              setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
            });
          }
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
