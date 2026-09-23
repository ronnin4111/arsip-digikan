import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAction } from '@/lib/log';

// POST /api/documents/[id]/restore - restore soft-deleted document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang dapat memulihkan dokumen' }, { status: 403 });
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
  if (!doc.deletedAt) {
    return NextResponse.json({ error: 'Dokumen tidak berada di trash' }, { status: 400 });
  }

  await db.document.update({
    where: { id: documentId },
    data: { deletedAt: null },
  });

  await logAction({
    action: 'RESTORE',
    documentId,
    documentTitle: doc.title,
    userId: authUser.id,
    username: authUser.username,
    request,
  });

  return NextResponse.json({ success: true });
}
