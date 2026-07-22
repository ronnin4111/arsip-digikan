/**
 * Extract text content from a PDF buffer for full-text search.
 * Uses pdf-parse. Returns null on failure or if text is empty.
 */
export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    // Dynamic import — pdf-parse is optional and heavy
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const data = await pdfParse(buffer);
    const text = (data?.text || '').trim();
    if (!text) return null;

    // Normalize whitespace
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return normalized;
  } catch (err) {
    console.error('PDF text extraction error:', err);
    return null;
  }
}
