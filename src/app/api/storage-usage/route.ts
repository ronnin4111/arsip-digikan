import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isBlobUrl, getBlobSize } from '@/lib/blob';

const LIMIT_BYTES = 100 * 1024 * 1024; // 100MB

export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const documents = await db.document.findMany({
      select: { pdfFilename: true },
    });

    let usedBytes = 0;
    const fileCount = documents.length;

    // Calculate actual blob sizes (with fallback to estimate)
    const sizePromises = documents.map(async (doc) => {
      if (isBlobUrl(doc.pdfFilename)) {
        return getBlobSize(doc.pdfFilename);
      }
      return 500 * 1024; // Fallback estimate 500KB
    });

    const sizes = await Promise.all(sizePromises);
    usedBytes = sizes.reduce((sum, size) => sum + size, 0);

    return NextResponse.json({
      usedBytes,
      limitBytes: LIMIT_BYTES,
      fileCount,
    });
  } catch (error) {
    console.error('Storage usage error:', error);
    return NextResponse.json({ error: 'Gagal mengambil informasi penyimpanan' }, { status: 500 });
  }
}
