import { put, del, head } from '@vercel/blob';

export async function uploadPdf(filename: string, buffer: Buffer): Promise<string> {
  const blob = await put(filename, buffer, {
    access: 'public',
    contentType: 'application/pdf',
    addRandomSuffix: true,
  });
  return blob.url;
}

export async function deletePdf(url: string): Promise<void> {
  await del(url);
}

export async function getPdfUrl(storedUrl: string): Promise<string | null> {
  try {
    const blob = await head(storedUrl);
    return blob ? storedUrl : null;
  } catch {
    return null;
  }
}

export function isBlobUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}
