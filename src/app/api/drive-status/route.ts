import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { isGoogleDriveConfigured, isGoogleDriveFileId, getAuthMethod } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const configured = isGoogleDriveConfigured();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  const authMethod = getAuthMethod();

  if (!configured) {
    return NextResponse.json({
      configured: false,
      authMethod,
      message: 'Google Drive not configured. Set the required env vars.',
    });
  }

  // Try to verify the folder and check accessibility
  try {
    // Dynamic import - only loads googleapis when checking drive status
    const { google } = await import('googleapis');

    let drive;

    if (authMethod === 'oauth2') {
      // OAuth2 with refresh token
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });
      drive = google.drive({
        version: 'v3',
        auth: client as Parameters<typeof google.drive>[0]['auth'],
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
        message: 'Service Account tidak bisa upload ke folder di My Drive (personal). Gunakan OAuth2 dengan refresh token atau buat Shared Drive.',
      });
    }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    return NextResponse.json({
      configured: true,
      working: false,
      authMethod,
      folderId,
      message: `Failed to verify Google Drive setup: ${err.message || 'Unknown error'}`,
      errorCode: err.code,
    });
  }
}
