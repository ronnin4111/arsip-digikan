import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { isGoogleDriveConfiguredAsync, isGoogleDriveFileId, getAuthMethodAsync, getSetting, invalidateDriveCache } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const configured = await isGoogleDriveConfiguredAsync();
  const folderId = (await getSetting('GOOGLE_DRIVE_FOLDER_ID')) || process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  const authMethod = await getAuthMethodAsync();
  // Surface to the UI whether refresh token comes from DB (runtime-saved) or env var
  const refreshTokenSource = (await getSetting('GOOGLE_REFRESH_TOKEN')) ? 'database' : (process.env.GOOGLE_REFRESH_TOKEN ? 'env_var' : 'none');

  if (!configured) {
    return NextResponse.json({
      configured: false,
      authMethod,
      folderId,
      refreshTokenSource,
      message: 'Google Drive not configured. Set the required env vars or click "Connect Google Drive" to authorize via OAuth.',
    });
  }

  // Try to verify the folder and check accessibility
  try {
    // Dynamic import - only loads googleapis when checking drive status
    const { google } = await import('googleapis');

    let drive;

    if (authMethod === 'oauth2') {
      // OAuth2 with refresh token (DB-stored or env var)
      const { OAuth2Client } = await import('google-auth-library');
      const refreshToken = await getSetting('GOOGLE_REFRESH_TOKEN');
      const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      client.setCredentials({
        refresh_token: refreshToken,
      });
      drive = google.drive({
        version: 'v3',
        auth: client as unknown as Parameters<typeof google.drive>[0]['auth'],
      });
    } else {
      // Service Account
      const { JWT } = await import('google-auth-library');
      const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      drive = google.drive({
        version: 'v3',
        auth: auth as unknown as Parameters<typeof google.drive>[0]['auth'],
      });
    }

    // Get folder info
    const folderRes = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,driveId',
      supportsAllDrives: true,
    });

    const folderData = folderRes.data as Record<string, unknown>;
    const driveId = folderData.driveId as string | undefined;
    const isInSharedDrive = !!driveId;

    // For OAuth2, uploads work regardless of Shared Drive
    if (authMethod === 'oauth2') {
      return NextResponse.json({
        configured: true,
        working: true,
        authMethod,
        folderId,
        folderName: folderData.name || '',
        isInSharedDrive,
        refreshTokenSource,
        message: 'Google Drive is properly configured with OAuth2.',
      });
    }

    // For Service Account, check if it's in a Shared Drive
    if (isInSharedDrive) {
      return NextResponse.json({
        configured: true,
        working: true,
        authMethod,
        folderId,
        folderName: folderData.name || '',
        isInSharedDrive: true,
        driveId,
        refreshTokenSource,
        message: 'Google Drive is properly configured with Service Account + Shared Drive.',
      });
    } else {
      // Service Account without Shared Drive - won't work for uploads
      let sharedDrives: Array<{ id: string; name: string }> = [];
      try {
        const drivesRes = await drive.drives.list({ pageSize: 10 });
        sharedDrives = (drivesRes.data.drives || []).map((d: any) => ({
          id: d.id || '',
          name: d.name || '',
        }));
      } catch {
        // Ignore
      }

      return NextResponse.json({
        configured: true,
        working: false,
        authMethod,
        folderId,
        folderName: folderData.name || '',
        isInSharedDrive: false,
        sharedDrives,
        refreshTokenSource,
        message: 'Service Account tidak bisa upload ke folder di My Drive (personal). Gunakan OAuth2 dengan refresh token atau buat Shared Drive.',
      });
    }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    // If error looks like an auth failure (invalid_grant), suggest re-authorize
    const isAuthError = (err.message || '').includes('invalid_grant') || (err.message || '').includes('invalid_token');
    return NextResponse.json({
      configured: true,
      working: false,
      authMethod,
      folderId,
      refreshTokenSource,
      message: `Failed to verify Google Drive setup: ${err.message || 'Unknown error'}`,
      errorCode: err.code,
      needsReauth: isAuthError,
    });
  }
}

/**
 * POST /api/drive-status
 * Body: { action: 'invalidate' }
 * Forces the next Drive call to re-read settings (used after OAuth callback saves a new refresh token).
 */
export async function POST(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  invalidateDriveCache();
  return NextResponse.json({ ok: true });
}
