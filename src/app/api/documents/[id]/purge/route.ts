import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAction } from '@/lib/log';
import { deletePdf } from '@/lib/blob';

// DELETE /api/documents/[id]/purge - permanently delete a soft-deleted document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }
  if (authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang dapat menghapus permanen' }, { status: 403 });
  }

  const { id } = await params;
  const documentId = Number(id);
  if (Number.isNaN(documentId)) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
  }

  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { attachments: true },
  });
  if (!doc) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
  }
  if (!doc.deletedAt) {
    return NextResponse.json({ error: 'Dokumen harus di-trash dulu sebelum dihapus permanen' }, { status: 400 });
  }

  // Delete files from Drive/Blob (best-effort)
  const deletePromises: Promise<void>[] = [];
  try { deletePromises.push(deletePdf(doc.pdfFilename).catch(() => {})); } catch {}
  for (const att of doc.attachments) {
    try { deletePromises.push(deletePdf(att.storageRef).catch(() => {})); } catch {}
  }
  await Promise.allSettled(deletePromises);

  // Delete DB record (cascade: attachments, bookmarks, logs.documentId will be set null)
  await db.document.delete({ where: { id: documentId } });

  await logAction({
    action: 'PURGE',
    documentTitle: doc.title,
    userId: authUser.id,
    username: authUser.username,
    request,
    detail: `Permanent delete ref=${doc.referenceNumber}`,
  });

  return NextResponse.json({ success: true });
}
