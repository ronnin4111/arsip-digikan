import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, JwtPayload } from '@/lib/auth';
import { isBlobUrl } from '@/lib/blob';
import { isGoogleDriveFileId } from '@/lib/google-drive';

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

    const pdfRef = document.pdfFilename;

    // Google Drive file ID → download the file and stream it directly
    // We can't use redirect because iframes can't display Google Drive URLs (X-Frame-Options)
    if (isGoogleDriveFileId(pdfRef)) {
      const { downloadFromDrive } = await import('@/lib/google-drive');
      const buffer = await downloadFromDrive(pdfRef);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${document.title}.pdf"`,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Vercel Blob URL → fetch the file and stream it
    // We proxy it to avoid iframe issues with cross-origin blob URLs
    if (isBlobUrl(pdfRef)) {
      const response = await fetch(pdfRef);
      if (!response.ok) {
        return NextResponse.json({ error: 'Gagal mengambil file dari storage' }, { status: 500 });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${document.title}.pdf"`,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    return NextResponse.json({ error: 'File PDF tidak ditemukan' }, { status: 404 });
  } catch (error) {
    console.error('Preview document error:', error);
    return NextResponse.json({ error: 'Gagal memuat dokumen' }, { status: 500 });
  }
}
