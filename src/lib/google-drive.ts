import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import type { drive_v3 } from 'googleapis';

/**
 * Google Drive integration for document storage.
 * Uses a Service Account for server-to-server authentication.
 *
 * Setup:
 * 1. Go to Google Cloud Console → Create Project
 * 2. Enable Google Drive API
 * 3. Create Service Account → Download JSON key
 * 4. Share a Google Drive folder with the service account email
 * 5. Set the folder ID in GOOGLE_DRIVE_FOLDER_ID env var
 */

// Lazy-initialized auth client
let authClient: JWT | null = null;
let driveInstance: drive_v3.Drive | null = null;

function getAuthClient(): JWT {
  if (authClient) return authClient;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY env vars.'
    );
  }

  authClient = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return authClient;
}

function getDrive(): drive_v3.Drive {
  if (driveInstance) return driveInstance;
  const auth = getAuthClient();
  // Use type assertion to work around type mismatch between JWT and OAuth2Client
  driveInstance = google.drive({ version: 'v3', auth: auth as unknown as Parameters<typeof google.drive>[0]['auth'] });
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
 */
export function isGoogleDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_DRIVE_FOLDER_ID
  );
}

/**
 * Upload a PDF file to Google Drive
 * @param filename - The name for the file in Google Drive
 * @param buffer - The file content as a Buffer
 * @returns The Google Drive file ID
 */
export async function uploadToDrive(filename: string, buffer: Buffer): Promise<string> {
  const drive = getDrive();
  const folderId = getFolderId();

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: 'application/pdf',
    },
    media: {
      mimeType: 'application/pdf',
      body: buffer,
    },
    fields: 'id',
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
  const drive = getDrive();
  await drive.files.delete({ fileId });
}

/**
 * Get a file's metadata from Google Drive
 * @param fileId - The Google Drive file ID
 */
export async function getFileInfo(fileId: string): Promise<{ size: number; name: string; mimeType: string } | null> {
  try {
    const drive = getDrive();
    const response = await drive.files.get({
      fileId,
      fields: 'size,name,mimeType',
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
  const drive = getDrive();

  // Try to create a permission for anyone with link to view
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
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
  const drive = getDrive();

  // Ensure the file is accessible
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
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
  const drive = getDrive();

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Get storage usage info for the Google Drive
 * @returns Storage usage in bytes and limit
 */
export async function getDriveStorageInfo(): Promise<{ usedBytes: number; limitBytes: number }> {
  const drive = getDrive();

  const response = await drive.about.get({
    fields: 'storageQuota',
  });

  const data = response.data as Record<string, unknown>;
  const quota = (data.storageQuota || {}) as Record<string, string>;
  return {
    usedBytes: parseInt(quota.usage || '0', 10),
    limitBytes: parseInt(quota.limit || '16106127360', 10), // Default 15GB
  };
}

/**
 * Check if a string is a Google Drive file ID
 * Google Drive file IDs are typically 28-60 character alphanumeric strings
 */
export function isGoogleDriveFileId(value: string): boolean {
  if (!value) return false;
  // Google Drive file IDs are alphanumeric with possible hyphens/underscores
  // They don't start with http and don't contain slashes or dots
  return !value.startsWith('http') && !value.includes('/') && !value.includes('.');
}

/**
 * List all files in the configured Google Drive folder
 */
export async function listDriveFiles(): Promise<Array<{ id: string; name: string; size: number }>> {
  const drive = getDrive();
  const folderId = getFolderId();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, size)',
    pageSize: 1000,
  });

  const files = (response.data.files || []) as Array<Record<string, string>>;
  return files.map((file) => ({
    id: file.id || '',
    name: file.name || '',
    size: parseInt(file.size || '0', 10),
  }));
}
