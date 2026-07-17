import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const LIMIT_BYTES = 100 * 1024 * 1024; // 100MB

export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const fileCount = await db.document.count();

    // Note: Exact byte counting for Vercel Blob requires Vercel API.
    // For now, we estimate based on document count.
    const estimatedBytesPerDoc = 500 * 1024; // Estimate 500KB per document
    const usedBytes = fileCount * estimatedBytesPerDoc;

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
