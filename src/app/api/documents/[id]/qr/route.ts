import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET /api/documents/[id]/qr - generate QR code PNG for a document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id } = await params;
  const documentId = Number(id);
  if (Number.isNaN(documentId)) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
  }

  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
  }

  // Public verify URL
  const verifyUrl = `${request.nextUrl.origin}/verify/${encodeURIComponent(doc.referenceNumber)}`;

  const QRCode = (await import('qrcode')).default;
  const pngBuffer = await QRCode.toBuffer(verifyUrl, {
    type: 'png',
    margin: 1,
    width: 256,
    color: { dark: '#1e293b', light: '#ffffff' },
  });

  return new NextResponse(pngBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
