import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAction } from '@/lib/log';
import { deletePdf } from '@/lib/blob';

// DELETE /api/documents/[id]/attachments/[attachmentId] - delete an attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const { id, attachmentId } = await params;
  const documentId = Number(id);
  const attId = Number(attachmentId);
  if (Number.isNaN(documentId) || Number.isNaN(attId)) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
  }

  const att = await db.attachment.findUnique({
    where: { id: attId },
    include: { document: true },
  });
  if (!att || att.documentId !== documentId) {
    return NextResponse.json({ error: 'Lampiran tidak ditemukan' }, { status: 404 });
  }

  // Best-effort delete from storage
  try { await deletePdf(att.storageRef); } catch (e) { console.warn('Failed to delete attachment file:', e); }

  await db.attachment.delete({ where: { id: attId } });

  await logAction({
    action: 'UPDATE',
    documentId,
    documentTitle: att.document.title,
    userId: authUser.id,
    username: authUser.username,
    request,
    detail: `Delete attachment ${att.filename}`,
  });

  return NextResponse.json({ success: true });
}
