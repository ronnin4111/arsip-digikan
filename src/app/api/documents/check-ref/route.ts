import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/documents/check-ref?reference_number=001/SK/2026&excludeId=24
 *
 * Real-time duplicate reference number check.
 * Used by the upload/edit form to warn the user BEFORE they hit submit.
 *
 * Response:
 *   200 OK
 *   {
 *     "exists": true,
 *     "duplicate": { "id": 17, "title": "Surat ...", "date": "2026-05-04" }
 *   }
 *   or
 *   { "exists": false, "duplicate": null }
 */
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawRef = searchParams.get('reference_number') || searchParams.get('referenceNumber') || '';
    const refNum = rawRef.trim();
    const excludeIdRaw = searchParams.get('excludeId');
    const excludeId = excludeIdRaw ? parseInt(excludeIdRaw, 10) : undefined;

    if (!refNum) {
      return NextResponse.json({ exists: false, duplicate: null });
    }

    const where: Record<string, unknown> = {
      referenceNumber: { equals: refNum, mode: 'insensitive' },
      deletedAt: null,
    };
    if (excludeId && !isNaN(excludeId)) {
      where.id = { not: excludeId };
    }

    const duplicate = await db.document.findFirst({
      where,
      select: { id: true, title: true, date: true, type: true, category: true },
    });

    return NextResponse.json({
      exists: !!duplicate,
      duplicate,
    });
  } catch (error) {
    console.error('Check-ref error:', error);
    return NextResponse.json({ error: 'Gagal memeriksa nomor surat' }, { status: 500 });
  }
}
