import { put, del, head } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';

// Pure functions re-exported directly (no googleapis loading)
export { isGoogleDriveConfigured, isGoogleDriveFileId } from './google-drive';

/**
 * Check if local filesystem storage mode is enabled.
 * Activated via STORAGE_MODE=local env var.
 */
export function isLocalStorageEnabled(): boolean {
  return process.env.STORAGE_MODE === 'local';
}

/**
 * Get the local storage directory (absolute path).
 */
function getLocalStorageDir(): string {
  const dir = process.env.LOCAL_STORAGE_DIR || './uploads';
  return path.resolve(process.cwd(), dir);
}

/**
 * Check if a string is a local filesystem path reference.
 * Local refs are stored as: "local:<relative-path>"
 */
export function isLocalRef(identifier: string): boolean {
  if (!identifier) return false;
  return identifier.startsWith('local:');
}

/**
 * Get the absolute filesystem path for a local ref.
 */
function resolveLocalRef(identifier: string): string {
  const rel = identifier.slice('local:'.length);
  return path.join(getLocalStorageDir(), rel);
}

/**
 * Upload a PDF file to storage (Local FS, Google Drive, or Vercel Blob)
 *
 * Priority:
 * 1. Local FS (if STORAGE_MODE=local) — dev mode
 * 2. Google Drive (if configured)
 * 3. Vercel Blob (fallback)
 *
 * @param filename - The name for the file
 * @param buffer - The file content as a Buffer
 * @returns Storage identifier (local ref, Google Drive file ID, or Vercel Blob URL)
 */
export async function uploadPdf(filename: string, buffer: Buffer): Promise<string> {
  // Mode 1: Local filesystem (dev)
  if (isLocalStorageEnabled()) {
    const dir = getLocalStorageDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);
    console.log(`[Storage] Local FS upload: ${filePath}`);
    return `local:${filename}`;
  }

  // Mode 2: Google Drive (if configured)
  const { isGoogleDriveConfigured, uploadToDrive } = await import('./google-drive');

  if (isGoogleDriveConfigured()) {
    try {
      console.log(`[Storage] Attempting Google Drive upload for: ${filename}`);
      const fileId = await uploadToDrive(filename, buffer);
      console.log(`[Storage] Google Drive upload successful. File ID: ${fileId}`);
      return fileId;
    } catch (error: unknown) {
      const gerr = error as { code?: number; message?: string; errors?: Array<{ message?: string; reason?: string }> };
      const errorDetail = gerr.errors?.length
        ? gerr.errors.map(e => `${e.reason}: ${e.message}`).join('; ')
        : gerr.message || 'Unknown error';
      console.error(
        `[Storage] Google Drive upload FAILED (code: ${gerr.code}): ${errorDetail}. Falling back to Vercel Blob.`
      );
    }
  }

  // Mode 3: Vercel Blob (fallback)
  const blob = await put(`documents/${filename}`, buffer, {
    access: 'public',
    contentType: 'application/pdf',
  });
  return blob.url;
}

/**
 * Delete a PDF file from storage
 */
export async function deletePdf(identifier: string): Promise<void> {
  // Local FS
  if (isLocalRef(identifier)) {
    try {
      await fs.unlink(resolveLocalRef(identifier));
    } catch (e) {
      console.warn('[Storage] Failed to delete local file:', identifier, e);
    }
    return;
  }

  // Google Drive
  const { isGoogleDriveFileId, deleteFromDrive } = await import('./google-drive');
  if (isGoogleDriveFileId(identifier)) {
    return deleteFromDrive(identifier);
  }

  // Vercel Blob
  if (isBlobUrl(identifier)) {
    await del(identifier);
    return;
  }

  console.warn('Unknown storage identifier, cannot delete:', identifier);
}

/**
 * Check if a string is a Vercel Blob URL
 */
export function isBlobUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('.vercel-storage.com') || url.includes('blob.vercel-storage.com');
}

/**
 * Get the size of a stored file
 */
export async function getFileSize(identifier: string): Promise<number> {
  try {
    // Local FS
    if (isLocalRef(identifier)) {
      const stat = await fs.stat(resolveLocalRef(identifier));
      return stat.size;
    }

    // Google Drive
    const { isGoogleDriveFileId, getFileInfo } = await import('./google-drive');
    if (isGoogleDriveFileId(identifier)) {
      const info = await getFileInfo(identifier);
      return info?.size ?? 0;
    }

    // Vercel Blob
    if (isBlobUrl(identifier)) {
      const blobDetails = await head(identifier);
      return blobDetails?.size ?? 0;
    }
  } catch {
    return 0;
  }
  return 0;
}

/**
 * Read a local file into a Buffer (used by preview/download routes).
 * Returns null if the identifier is not a local ref.
 */
export async function readLocalFile(identifier: string): Promise<Buffer | null> {
  if (!isLocalRef(identifier)) return null;
  try {
    return await fs.readFile(resolveLocalRef(identifier));
  } catch (e) {
    console.error('[Storage] Failed to read local file:', identifier, e);
    return null;
  }
}

/**
 * Get the preview/view URL for a document
 */
export async function getPreviewUrl(identifier: string): Promise<string | null> {
  try {
    // Local FS — preview is served via /api/documents/[id]/preview
    if (isLocalRef(identifier)) {
      return null; // signals to use the API route directly
    }

    const { isGoogleDriveFileId, getFileViewLink } = await import('./google-drive');
    if (isGoogleDriveFileId(identifier)) {
      return getFileViewLink(identifier);
    }

    if (isBlobUrl(identifier)) {
      return identifier;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Get the download URL for a document
 */
export async function getDownloadUrl(identifier: string): Promise<string | null> {
  try {
    // Local FS — download is served via /api/documents/[id]/download
    if (isLocalRef(identifier)) {
      return null;
    }

    const { isGoogleDriveFileId, getFileDownloadUrl } = await import('./google-drive');
    if (isGoogleDriveFileId(identifier)) {
      return getFileDownloadUrl(identifier);
    }

    if (isBlobUrl(identifier)) {
      return identifier;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Get storage usage information
 */
export async function getStorageUsage(): Promise<{ usedBytes: number; limitBytes: number; fileCount: number; storageType: string }> {
  // Local FS mode
  if (isLocalStorageEnabled()) {
    const dir = getLocalStorageDir();
    let usedBytes = 0;
    let fileCount = 0;
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        const stat = await fs.stat(path.join(dir, entry));
        if (stat.isFile()) {
          usedBytes += stat.size;
          fileCount++;
        }
      }
    } catch {
      // dir doesn't exist yet
    }
    return {
      usedBytes,
      limitBytes: 1024 * 1024 * 1024, // 1 GB local limit (arbitrary)
      fileCount,
      storageType: 'local',
    };
  }

  // Google Drive
  const { isGoogleDriveConfigured, getDriveStorageInfo } = await import('./google-drive');
  if (isGoogleDriveConfigured()) {
    try {
      const driveInfo = await getDriveStorageInfo();
      return {
        usedBytes: driveInfo.usedBytes,
        limitBytes: driveInfo.limitBytes,
        fileCount: 0,
        storageType: 'google-drive',
      };
    } catch {
      // Fall through
    }
  }

  return {
    usedBytes: 0,
    limitBytes: 250 * 1024 * 1024, // Vercel Blob free tier: 250MB
    fileCount: 0,
    storageType: 'vercel-blob',
  };
}
