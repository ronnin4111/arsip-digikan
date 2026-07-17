import { put, del, head } from '@vercel/blob';
import {
  isGoogleDriveConfigured as gdIsConfigured,
  uploadToDrive,
  deleteFromDrive,
  getFileInfo,
  getFileViewLink,
  getFileDownloadUrl,
  isGoogleDriveFileId as gdIsFileId,
  getDriveStorageInfo,
} from './google-drive';

// Re-export for convenience
export { isGoogleDriveFileId } from './google-drive';

/**
 * Upload a PDF file to storage (Google Drive or Vercel Blob)
 * @param filename - The name for the file
 * @param buffer - The file content as a Buffer
 * @returns Storage identifier (Google Drive file ID or Vercel Blob URL)
 */
export async function uploadPdf(filename: string, buffer: Buffer): Promise<string> {
  if (gdIsConfigured()) {
    // Upload to Google Drive - return the file ID
    return uploadToDrive(filename, buffer);
  }

  // Fallback: Upload to Vercel Blob
  const blob = await put(`documents/${filename}`, buffer, {
    access: 'public',
    contentType: 'application/pdf',
  });
  return blob.url;
}

/**
 * Delete a PDF file from storage
 * @param identifier - Google Drive file ID or Vercel Blob URL
 */
export async function deletePdf(identifier: string): Promise<void> {
  if (gdIsFileId(identifier)) {
    return deleteFromDrive(identifier);
  }

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
 * @param identifier - Google Drive file ID or Vercel Blob URL
 * @returns Size in bytes
 */
export async function getFileSize(identifier: string): Promise<number> {
  try {
    if (gdIsFileId(identifier)) {
      const info = await getFileInfo(identifier);
      return info?.size ?? 0;
    }

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
 * Get the preview/view URL for a document
 * @param identifier - Google Drive file ID or Vercel Blob URL
 * @returns URL that can be used to preview the PDF
 */
export async function getPreviewUrl(identifier: string): Promise<string | null> {
  try {
    if (gdIsFileId(identifier)) {
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
 * @param identifier - Google Drive file ID or Vercel Blob URL
 * @returns URL that can be used to download the PDF
 */
export async function getDownloadUrl(identifier: string): Promise<string | null> {
  try {
    if (gdIsFileId(identifier)) {
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
 * Returns combined usage from Google Drive or Vercel Blob
 */
export async function getStorageUsage(): Promise<{ usedBytes: number; limitBytes: number; fileCount: number }> {
  if (gdIsConfigured()) {
    try {
      const driveInfo = await getDriveStorageInfo();
      // We can't easily count just our folder's files without listing them,
      // so we return the overall Drive storage usage
      return {
        usedBytes: driveInfo.usedBytes,
        limitBytes: driveInfo.limitBytes,
        fileCount: 0, // Will be filled from DB count
      };
    } catch {
      // Fall through to blob calculation
    }
  }

  return {
    usedBytes: 0,
    limitBytes: 250 * 1024 * 1024, // Vercel Blob free tier: 250MB
    fileCount: 0,
  };
}
