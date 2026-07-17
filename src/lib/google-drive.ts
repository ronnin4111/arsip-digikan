/**
 * Google Drive integration for document storage.
 * Uses a Service Account for server-to-server authentication.
 *
 * IMPORTANT: This module uses LAZY/DYNAMIC imports for googleapis
 * to avoid loading the heavy module when it's not needed.
 * Only routes that actually use Google Drive APIs will load the module.
 *
 * IMPORTANT: Service Accounts do NOT have storage quota.
 * You MUST use a Shared Drive (formerly Team Drive) for uploads.
 *
 * Setup:
 * 1. Go to Google Cloud Console → Create Project
 * 2. Enable Google Drive API
 * 3. Create Service Account → Download JSON key
 * 4. Create a Shared Drive in Google Drive
 * 5. Add the service account email as a Contributor/Content manager to the Shared Drive
 * 6. Create a folder inside the Shared Drive (or use the Shared Drive root)
 * 7. Set the folder/drive ID in GOOGLE_DRIVE_FOLDER_ID env var
 */

// Types for lazy-loaded modules
type JWTType = import('google-auth-library').JWT;
type DriveType = import('googleapis').drive_v3.Drive;

// Lazy-initialized instances (not loaded until first use)
let authClient: JWTType | null = null;
let driveInstance: DriveType | null = null;

async function getAuthClient(): Promise<JWTType> {
  if (authClient) return authClient;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY env vars.'
    );
  }

  // Dynamic import - only loads google-auth-library when actually needed
  const { JWT } = await import('google-auth-library');

  authClient = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return authClient;
}

async function getDrive(): Promise<DriveType> {
  if (driveInstance) return driveInstance;
  const auth = await getAuthClient();

  // Dynamic import - only loads googleapis when actually needed
  const { google } = await import('googleapis');

  driveInstance = google.drive({
    version: 'v3',
    auth: auth as unknown as Parameters<typeof google.drive>[0]['auth'],
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
 * Check if Google Drive is configured (env vars are set)
 * This is a pure function - NO googleapis import needed
 */
export function isGoogleDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

/**
 * Check if a string is a Google Drive file ID
 * This is a pure function - NO googleapis import needed
 * Google Drive file IDs are typically 28-60 character alphanumeric strings
 */
export function isGoogleDriveFileId(value: string): boolean {
  if (!value) return false;
  // Google Drive file IDs are alphanumeric with possible hyphens/underscores
  // They don't start with http and don't contain slashes or dots
  return !value.startsWith('http') && !value.includes('/') && !value.includes('.');
}

/**
 * Upload a PDF file to Google Drive
 *
 * Service Accounts don't have storage quota, so files MUST be uploaded
 * to a Shared Drive. The supportsAllDrives parameter is set to true.
 *
 * @param filename - The name for the file in Google Drive
 * @param buffer - The file content as a Buffer
 * @returns The Google Drive file ID
 */
export async function uploadToDrive(filename: string, buffer: Buffer): Promise<string> {
  const drive = await getDrive();
  const folderId = getFolderId();

  // Convert Buffer to Readable stream (googleapis requires a stream for media.body)
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
    // Required for Shared Drives - Service Accounts don't have their own quota
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error('Failed to upload file to Google Drive: no file ID returned.');
  }

  return response.data.id;
}

/**
 * Delete a file from Google Drive
 * @param fileId - The Google Drive file ID
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
 * @param fileId - The Google Drive file ID
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
    // File might have been deleted from Drive directly
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

  // Try to create a permission for anyone with link to view
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
    // Permission might already exist, that's fine
  }

  // Return the embed/view URL
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Get the direct download URL for a Google Drive file
 * @param fileId - The Google Drive file ID
 * @returns Direct download URL
 */
export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const drive = await getDrive();

  // Ensure the file is accessible
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
 * @param fileId - The Google Drive file ID
 * @returns Buffer with file content
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
 *
 * IMPORTANT: Service Accounts don't have their own storage quota,
 * so `drive.about.get({ fields: 'storageQuota' })` returns 0 usage.
 * Instead, we calculate actual used bytes by listing all files in the
 * configured folder and summing their sizes.
 *
 * @returns Storage usage in bytes and limit (defaults to 15GB for Google Drive free tier)
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
