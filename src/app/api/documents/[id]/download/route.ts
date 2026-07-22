import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, JwtPayload } from '@/lib/auth';
import { isBlobUrl, isLocalRef, readLocalFile } from '@/lib/blob';
import { isGoogleDriveFileId } from '@/lib/google-drive';
import { logAction } from '@/lib/log';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let authUser: JwtPayload | null = null;

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      authUser = verifyToken(parts[1]);
    }
  }

  if (!authUser) {
    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      authUser = verifyToken(tokenParam);
    }
  }

  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const documentId = parseInt(id, 10);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'ID dokumen tidak valid' }, { status: 400 });
    }

    const document = await db.document.findUnique({ where: { id: documentId } });
    if (!document) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    }

    // Log DOWNLOAD action (best-effort, don't block on it)
    logAction({
      action: 'DOWNLOAD',
      documentId: document.id,
      documentTitle: document.title,
      userId: authUser.id,
      username: authUser.username,
      request,
    }).catch(() => {});

    const pdfRef = document.pdfFilename;

    // Local FS file → read from disk and stream as attachment
    if (isLocalRef(pdfRef)) {
      const buffer = await readLocalFile(pdfRef);
      if (!buffer) {
        return NextResponse.json({ error: 'File PDF tidak ditemukan di storage lokal' }, { status: 404 });
      }
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${document.title}.pdf"`,
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    // Google Drive file ID → download the file and stream it as attachment
    if (isGoogleDriveFileId(pdfRef)) {
      const { downloadFromDrive } = await import('@/lib/google-drive');
      const buffer = await downloadFromDrive(pdfRef);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${document.title}.pdf"`,
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    // Vercel Blob URL → redirect directly for download
    if (isBlobUrl(pdfRef)) {
      return NextResponse.redirect(pdfRef);
    }

    return NextResponse.json({ error: 'File PDF tidak ditemukan' }, { status: 404 });
  } catch (error) {
    console.error('Download document error:', error);
    return NextResponse.json({ error: 'Gagal mengunduh dokumen' }, { status: 500 });
  }
}
