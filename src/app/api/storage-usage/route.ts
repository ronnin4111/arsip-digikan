import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getAuthUser } from '@/lib/auth';

const LIMIT_BYTES = 100 * 1024 * 1024; // 100MB

// GET /api/storage-usage - Get storage usage stats
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: 'Tidak terautentikasi' },
      { status: 401 }
    );
  }

  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');

    let usedBytes = 0;
    let fileCount = 0;

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.'));

      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          usedBytes += stats.size;
          fileCount++;
        }
      }
    }

    return NextResponse.json({
      usedBytes,
      limitBytes: LIMIT_BYTES,
      fileCount,
    });
  } catch (error) {
    console.error('Storage usage error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil informasi penyimpanan' },
      { status: 500 }
    );
  }
}
