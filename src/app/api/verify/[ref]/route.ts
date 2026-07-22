import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/verify/[ref] - public document verification (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const refNumber = decodeURIComponent(ref);

  const doc = await db.document.findFirst({
    where: {
      referenceNumber: { equals: refNumber, mode: 'insensitive' },
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      title: true,
      referenceNumber: true,
      category: true,
      seksi: true,
      sender: true,
      recipient: true,
      date: true,
      status: true,
      createdAt: true,
    },
  });

  if (!doc) {
    return NextResponse.json({ found: false });
  }

  const TYPE_LABEL: Record<string, string> = {
    INCOMING: 'Surat Masuk',
    OUTGOING: 'Surat Keluar',
    SURAT_TUGAS: 'Surat Tugas',
    SURAT_KEPUTUSAN: 'Surat Keputusan',
  };

  return NextResponse.json({
    found: true,
    document: {
      id: doc.id,
      type: doc.type,
      typeLabel: TYPE_LABEL[doc.type] || doc.type,
      title: doc.title,
      referenceNumber: doc.referenceNumber,
      category: doc.category,
      seksi: doc.seksi,
      sender: doc.sender,
      recipient: doc.recipient,
      date: doc.date,
      status: doc.status,
      createdAt: doc.createdAt,
    },
  });
}
