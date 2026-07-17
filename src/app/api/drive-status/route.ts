import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { isGoogleDriveConfigured } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const configured = isGoogleDriveConfigured();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

  if (!configured) {
    return NextResponse.json({
      configured: false,
      message: 'Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID env vars.',
    });
  }

  // Try to verify the folder and check if it's in a Shared Drive
  try {
    // Dynamic import - only loads googleapis when checking drive status
    const { google } = await import('googleapis');
    const { JWT } = await import('google-auth-library');

    const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n');

    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({
      version: 'v3',
      auth: auth as unknown as Parameters<typeof google.drive>[0]['auth'],
    });

    // Get folder info
    const folderRes = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,driveId,capabilities',
      supportsAllDrives: true,
    });

    const folderData = folderRes.data as Record<string, unknown>;
    const driveId = folderData.driveId as string | undefined;
    const isInSharedDrive = !!driveId;

    // List shared drives
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

    if (isInSharedDrive) {
      return NextResponse.json({
        configured: true,
        working: true,
        folderId,
        folderName: folderData.name || '',
        isInSharedDrive: true,
        driveId,
        message: 'Google Drive is properly configured with a Shared Drive.',
      });
    } else {
      return NextResponse.json({
        configured: true,
        working: false,
        folderId,
        folderName: folderData.name || '',
        isInSharedDrive: false,
        sharedDrives,
        message: 'Folder is in a personal Drive. Service Accounts cannot upload to personal folders. Please create a Shared Drive and add the service account as a member.',
        setupSteps: [
          '1. Go to Google Drive (drive.google.com)',
          '2. Click "Shared Drives" → "New shared drive"',
          '3. Name it "Arsip-Digikan Storage"',
          `4. Add "${clientEmail}" as a Content manager`,
          '5. Create a folder inside the Shared Drive (or use the Shared Drive root)',
          '6. Update GOOGLE_DRIVE_FOLDER_ID with the new folder/drive ID',
        ],
      });
    }
  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    return NextResponse.json({
      configured: true,
      working: false,
      folderId,
      message: `Failed to verify Google Drive setup: ${err.message || 'Unknown error'}`,
      errorCode: err.code,
    });
  }
}
