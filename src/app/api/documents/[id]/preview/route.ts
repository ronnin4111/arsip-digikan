import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/documents/:id/preview - Serve PDF file for preview
// Supports auth via Authorization header or token query parameter (for iframes)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Try to get auth from header or query parameter
  let authUser = null;

  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      authUser = verifyToken(parts[1]);
    }
  }

  // Fall back to token query parameter (for iframe previews)
  if (!authUser) {
    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      authUser = verifyToken(tokenParam);
    }
  }

  if (!authUser) {
    return NextResponse.json(
      { error: 'Tidak terautentikasi' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const documentId = parseInt(id, 10);

    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: 'ID dokumen tidak valid' },
        { status: 400 }
      );
    }

    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan' },
        { status: 404 }
      );
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, document.pdfFilename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File PDF tidak ditemukan' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${document.pdfFilename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Preview document error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat dokumen' },
      { status: 500 }
    );
  }
}
