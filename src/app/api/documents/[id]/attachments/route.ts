import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAction } from '@/lib/log';

// GET /api/documents/[id]/attachments - list attachments for a document
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

  const attachments = await db.attachment.findMany({
    where: { documentId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(
    attachments.map((a) => ({
      id: a.id,
      document_id: a.documentId,
      filename: a.filename,
      storage_ref: a.storageRef,
      file_size: a.fileSize,
      mime_type: a.mimeType,
      created_at: a.createdAt,
    }))
  );
}

// POST /api/documents/[id]/attachments - upload additional attachment
export async function POST(
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

  const formData = await request.formData();
  const file = (formData.get('file') as File | null) || (formData.get('pdf') as File | null);
  if (!file) {
    return NextResponse.json({ error: 'File wajib diunggah' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 });
  }

  const { uploadPdf } = await import('@/lib/blob');
  const unique = `att-${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const storageRef = await uploadPdf(unique, buffer);

  const att = await db.attachment.create({
    data: {
      documentId,
      filename: file.name,
      storageRef,
      fileSize: file.size,
      mimeType: file.type || 'application/pdf',
    },
  });

  await logAction({
    action: 'UPDATE',
    documentId,
    documentTitle: doc.title,
    userId: authUser.id,
    username: authUser.username,
    request,
    detail: `Add attachment ${file.name}`,
  });

  return NextResponse.json({
    id: att.id,
    document_id: att.documentId,
    filename: att.filename,
    storage_ref: att.storageRef,
    file_size: att.fileSize,
    mime_type: att.mimeType,
    created_at: att.createdAt,
  }, { status: 201 });
}
