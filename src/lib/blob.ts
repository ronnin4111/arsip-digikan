import { put, del, head } from '@vercel/blob';

/**
 * Upload a PDF file to Vercel Blob storage
 * @param filename - The name for the blob file
 * @param buffer - The file content as a Buffer
 * @returns The URL of the uploaded blob
 */
export async function uploadPdf(filename: string, buffer: Buffer): Promise<string> {
  const blob = await put(`documents/${filename}`, buffer, {
    access: 'public',
    contentType: 'application/pdf',
  });
  return blob.url;
}

/**
 * Delete a PDF file from Vercel Blob storage
 * @param url - The blob URL to delete
 */
export async function deletePdf(url: string): Promise<void> {
  await del(url);
}

/**
 * Check if a string is a Vercel Blob URL
 * @param url - The string to check
 * @returns True if it's a Vercel Blob URL
 */
export function isBlobUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('.vercel-storage.com') || url.includes('blob.vercel-storage.com');
}

/**
 * Get the size of a blob file
 * @param url - The blob URL
 * @returns The size in bytes, or 0 if not found
 */
export async function getBlobSize(url: string): Promise<number> {
  try {
    const blobDetails = await head(url);
    return blobDetails?.size ?? 0;
  } catch {
    return 0;
  }
}
