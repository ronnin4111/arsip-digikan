import { put, del, head } from '@vercel/blob';

// Pure functions re-exported directly (no googleapis loading)
export { isGoogleDriveConfigured, isGoogleDriveFileId } from './google-drive';

/**
 * Upload a PDF file to storage (Google Drive or Vercel Blob)
 * Uses dynamic imports for Google Drive to avoid loading googleapis eagerly.
 *
 * @param filename - The name for the file
 * @param buffer - The file content as a Buffer
 * @returns Storage identifier (Google Drive file ID or Vercel Blob URL)
 */
export async function uploadPdf(filename: string, buffer: Buffer): Promise<string> {
  // Dynamic import - only loads googleapis when actually uploading
  const { isGoogleDriveConfigured, uploadToDrive } = await import('./google-drive');

  if (isGoogleDriveConfigured()) {
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
 * Uses dynamic imports for Google Drive to avoid loading googleapis eagerly.
 *
 * @param identifier - Google Drive file ID or Vercel Blob URL
 */
export async function deletePdf(identifier: string): Promise<void> {
  // Dynamic import - only loads googleapis when actually deleting
  const { isGoogleDriveFileId, deleteFromDrive } = await import('./google-drive');

  if (isGoogleDriveFileId(identifier)) {
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
 * Uses dynamic imports for Google Drive to avoid loading googleapis eagerly.
 *
 * @param identifier - Google Drive file ID or Vercel Blob URL
 * @returns Size in bytes
 */
export async function getFileSize(identifier: string): Promise<number> {
  try {
    const { isGoogleDriveFileId, getFileInfo } = await import('./google-drive');

    if (isGoogleDriveFileId(identifier)) {
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
 * Uses dynamic imports for Google Drive to avoid loading googleapis eagerly.
 *
 * @param identifier - Google Drive file ID or Vercel Blob URL
 * @returns URL that can be used to preview the PDF
 */
export async function getPreviewUrl(identifier: string): Promise<string | null> {
  try {
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
 * Uses dynamic imports for Google Drive to avoid loading googleapis eagerly.
 *
 * @param identifier - Google Drive file ID or Vercel Blob URL
 * @returns URL that can be used to download the PDF
 */
export async function getDownloadUrl(identifier: string): Promise<string | null> {
  try {
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
 * Uses dynamic imports for Google Drive to avoid loading googleapis eagerly.
 *
 * Returns combined usage from Google Drive or Vercel Blob
 */
export async function getStorageUsage(): Promise<{ usedBytes: number; limitBytes: number; fileCount: number }> {
  const { isGoogleDriveConfigured, getDriveStorageInfo } = await import('./google-drive');

  if (isGoogleDriveConfigured()) {
    try {
      const driveInfo = await getDriveStorageInfo();
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
