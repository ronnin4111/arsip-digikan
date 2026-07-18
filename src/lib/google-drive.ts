/**
 * Google Drive integration for document storage.
 *
 * Supports TWO authentication methods:
 *
 * 1. OAuth2 with Refresh Token (RECOMMENDED for personal Gmail accounts)
 *    - Works with personal @gmail.com accounts
 *    - Files are stored using your personal Drive's 15GB quota
 *    - Setup: Get refresh token via Google OAuth2 Playground
 *    - Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *
 * 2. Service Account (REQUIRES Shared Drive / Google Workspace)
 *    - Service Accounts have NO storage quota
 *    - Can ONLY upload to Shared Drives, NOT personal folders
 *    - Env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
 *    - Also requires: GOOGLE_DRIVE_FOLDER_ID pointing to a Shared Drive folder
 *
 * Fallback: If Google Drive upload fails, Vercel Blob is used (250MB free)
 */

// Types for lazy-loaded modules
type AuthClientType = import('google-auth-library').JWT | import('google-auth-library').OAuth2Client;
type DriveType = import('googleapis').drive_v3.Drive;

// Lazy-initialized instances (not loaded until first use)
let authClient: AuthClientType | null = null;
let driveInstance: DriveType | null = null;

/**
 * Check if OAuth2 with refresh token is configured
 */
function isOAuth2Configured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

/**
 * Check if Service Account is configured
 */
function isServiceAccountConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

async function getAuthClient(): Promise<AuthClientType> {
  if (authClient) return authClient;

  // Priority 1: OAuth2 with refresh token (works with personal Gmail)
  if (isOAuth2Configured()) {
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    authClient = client;
    return authClient;
  }

  // Priority 2: Service Account (requires Shared Drive)
  if (isServiceAccountConfigured()) {
    const { JWT } = await import('google-auth-library');
    authClient = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return authClient;
  }

  throw new Error(
    'Google Drive not configured. Set either OAuth2 vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) or Service Account vars (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).'
  );
}

async function getDrive(): Promise<DriveType> {
  if (driveInstance) return driveInstance;
  const auth = await getAuthClient();

  const { google } = await import('googleapis');

  driveInstance = google.drive({
    version: 'v3',
    auth: auth as Parameters<typeof google.drive>[0]['auth'],
  });

  return driveInstance;
}

function getFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID env var is not set.');
  }
  return folderId;
}

/**
 * Check if Google Drive is configured (any method)
 * This is a pure function - NO googleapis import needed
 */
export function isGoogleDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
    (isOAuth2Configured() || isServiceAccountConfigured())
  );
}

/**
 * Get the authentication method being used
 */
export function getAuthMethod(): 'oauth2' | 'service-account' | 'none' {
  if (isOAuth2Configured()) return 'oauth2';
  if (isServiceAccountConfigured()) return 'service-account';
  return 'none';
}

/**
 * Check if a string is a Google Drive file ID
 */
export function isGoogleDriveFileId(value: string): boolean {
  if (!value) return false;
  return !value.startsWith('http') && !value.includes('/') && !value.includes('.');
}

/**
 * Upload a PDF file to Google Drive
 */
export async function uploadToDrive(filename: string, buffer: Buffer): Promise<string> {
  const drive = await getDrive();
  const folderId = getFolderId();

  const { Readable } = await import('stream');
  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: 'application/pdf',
    },
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error('Failed to upload file to Google Drive: no file ID returned.');
  }

  return response.data.id;
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = await getDrive();
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });
}

/**
 * Get a file's metadata from Google Drive
 */
export async function getFileInfo(fileId: string): Promise<{ size: number; name: string; mimeType: string } | null> {
  try {
    const drive = await getDrive();
    const response = await drive.files.get({
      fileId,
      fields: 'size,name,mimeType',
      supportsAllDrives: true,
    });
    const data = response.data as Record<string, unknown>;
    return {
      size: parseInt((data.size as string) || '0', 10),
      name: (data.name as string) || '',
      mimeType: (data.mimeType as string) || '',
    };
  } catch (error: unknown) {
    const gerr = error as { code?: number };
    if (gerr.code === 404) return null;
    throw error;
  }
}

/**
 * Generate a viewer link for a file in Google Drive.
 * Sets the file to be viewable by anyone with the link.
 */
export async function getFileViewLink(fileId: string): Promise<string> {
  const drive = await getDrive();

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch {
    // Permission might already exist
  }

  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Get the direct download URL for a Google Drive file
 */
export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const drive = await getDrive();

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch {
    // Permission might already exist
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Download a file from Google Drive
 */
export async function downloadFromDrive(fileId: string): Promise<Buffer> {
  const drive = await getDrive();

  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Get storage usage info for the Google Drive folder.
 */
export async function getDriveStorageInfo(): Promise<{ usedBytes: number; limitBytes: number }> {
  const files = await listDriveFiles();
  const usedBytes = files.reduce((sum, file) => sum + file.size, 0);

  // Google Drive free tier is 15GB
  const limitBytes = 15 * 1024 * 1024 * 1024; // 15 GB

  return { usedBytes, limitBytes };
}

/**
 * List all files in the configured Google Drive folder
 */
export async function listDriveFiles(): Promise<Array<{ id: string; name: string; size: number }>> {
  const drive = await getDrive();
  const folderId = getFolderId();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, size)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = (response.data.files || []) as Array<Record<string, string>>;
  return files.map((file) => ({
    id: file.id || '',
    name: file.name || '',
    size: parseInt(file.size || '0', 10),
  }));
}
