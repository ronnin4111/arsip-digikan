import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import {
  isBlobUrl,
  isLocalRef,
  isLocalStorageEnabled,
  getFileSize,
  getStorageUsage,
} from '@/lib/blob';
import { isGoogleDriveConfigured, isGoogleDriveFileId } from '@/lib/google-drive';

export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const documents = await db.document.findMany({
      select: { pdfFilename: true },
    });

    const fileCount = documents.length;

    // Local FS mode — calculate from local files
    if (isLocalStorageEnabled()) {
      const info = await getStorageUsage();
      return NextResponse.json({
        usedBytes: info.usedBytes,
        limitBytes: info.limitBytes,
        fileCount,
        storageType: 'local',
      });
    }

    // Google Drive mode
    if (isGoogleDriveConfigured()) {
      try {
        const driveInfo = await getStorageUsage();
        return NextResponse.json({
          usedBytes: driveInfo.usedBytes,
          limitBytes: driveInfo.limitBytes,
          fileCount,
          storageType: 'google-drive',
        });
      } catch (error) {
        console.error('Failed to get Google Drive storage info:', error);
      }
    }

    // Vercel Blob / unknown — calculate from individual files
    let usedBytes = 0;
    const sizePromises = documents.map(async (doc) => {
      const ref = doc.pdfFilename;
      if (isGoogleDriveFileId(ref) || isBlobUrl(ref) || isLocalRef(ref)) {
        return getFileSize(ref);
      }
      return 500 * 1024; // Fallback estimate 500KB
    });

    const sizes = await Promise.all(sizePromises);
    usedBytes = sizes.reduce((sum, size) => sum + size, 0);

    const limitBytes = isGoogleDriveConfigured()
      ? 15 * 1024 * 1024 * 1024
      : 250 * 1024 * 1024;

    return NextResponse.json({
      usedBytes,
      limitBytes,
      fileCount,
      storageType: isGoogleDriveConfigured() ? 'google-drive' : 'vercel-blob',
    });
  } catch (error) {
    console.error('Storage usage error:', error);
    return NextResponse.json({ error: 'Gagal mengambil informasi penyimpanan' }, { status: 500 });
  }
}
