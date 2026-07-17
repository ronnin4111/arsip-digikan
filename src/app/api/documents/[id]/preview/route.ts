import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, JwtPayload } from '@/lib/auth';
import { isBlobUrl } from '@/lib/blob';

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

    // If it's a blob URL, redirect to it directly (public blobs are accessible)
    if (isBlobUrl(document.pdfFilename)) {
      return NextResponse.redirect(document.pdfFilename);
    }

    // Fallback: return error for local files (shouldn't happen in production)
    return NextResponse.json({ error: 'File PDF tidak ditemukan' }, { status: 404 });
  } catch (error) {
    console.error('Preview document error:', error);
    return NextResponse.json({ error: 'Gagal memuat dokumen' }, { status: 500 });
  }
}
