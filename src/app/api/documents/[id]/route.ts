import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAction } from '@/lib/log';

function transformDoc(doc: any) {
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    reference_number: doc.referenceNumber,
    category: doc.category,
    sender: doc.sender,
    recipient: doc.recipient,
    date: doc.date,
    seksi: doc.seksi,
    pdf_filename: doc.pdfFilename,
    status: doc.status,
    text_content: doc.textContent,
    physical_location: doc.physicalLocation,
    deleted_at: doc.deletedAt,
    created_at: doc.createdAt,
    created_by: doc.createdBy,
    attachments: (doc.attachments || []).map((a: any) => ({
      id: a.id,
      document_id: a.documentId,
      filename: a.filename,
      storage_ref: a.storageRef,
      file_size: a.fileSize,
      mime_type: a.mimeType,
      created_at: a.createdAt,
    })),
    bookmarked: !!doc.bookmarked?.length,
  };
}

// PUT /api/documents/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const documentId = parseInt(id, 10);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'ID dokumen tidak valid' }, { status: 400 });
    }

    const existing = await db.document.findUnique({ where: { id: documentId } });
    if (!existing) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json();
    const { type, title, reference_number, referenceNumber, category, sender, recipient, date, seksi, status } = body;
    const refNum = (reference_number || referenceNumber || '').trim();
    // Detect whether the caller sent either snake_case or camelCase physicalLocation key.
    // Only update the column when the key was actually present in the body — otherwise
    // we'd wipe an existing value just because the caller omitted the field.
    const hasPhysicalLocation = Object.prototype.hasOwnProperty.call(body, 'physical_location') || Object.prototype.hasOwnProperty.call(body, 'physicalLocation');
    const physicalLocRaw = body.physical_location ?? body.physicalLocation ?? null;
    const physicalLocationValue = typeof physicalLocRaw === 'string' && physicalLocRaw.trim() === '' ? null : physicalLocRaw;

    // === Duplicate reference number detection (skip current document) ===
    if (refNum) {
      const dup = await db.document.findFirst({
        where: {
          referenceNumber: { equals: refNum, mode: 'insensitive' },
          id: { not: documentId },
          deletedAt: null,
        },
        select: { id: true, title: true, date: true },
      });
      if (dup) {
        return NextResponse.json(
          {
            error: `Nomor surat "${refNum}" sudah dipakai dokumen lain (ID: ${dup.id}, tanggal: ${dup.date}).`,
            code: 'DUPLICATE_REFERENCE_NUMBER',
            duplicate: dup,
          },
          { status: 409 }
        );
      }
    }

    const updated = await db.document.update({
      where: { id: documentId },
      data: {
        ...(type !== undefined && { type }),
        ...(title !== undefined && { title }),
        ...(refNum !== undefined && refNum !== '' && { referenceNumber: refNum }),
        ...(category !== undefined && { category }),
        ...(sender !== undefined && { sender }),
        ...(recipient !== undefined && { recipient }),
        ...(date !== undefined && { date }),
        ...(seksi !== undefined && { seksi }),
        ...(status !== undefined && { status }),
        ...(physicalLocationValue !== undefined && hasPhysicalLocation && { physicalLocation: physicalLocationValue }),
      },
    });

    await logAction({
      action: 'UPDATE',
      documentId: updated.id,
      documentTitle: updated.title,
      userId: authUser.id,
      username: authUser.username,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui dokumen' }, { status: 500 });
  }
}

// DELETE /api/documents/:id — soft delete (move to trash)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const documentId = parseInt(id, 10);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'ID dokumen tidak valid' }, { status: 400 });
    }

    const existing = await db.document.findUnique({ where: { id: documentId } });
    if (!existing) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    }

    // Soft delete: set deletedAt instead of removing row
    await db.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    await logAction({
      action: 'DELETE',
      documentId,
      documentTitle: existing.title,
      userId: authUser.id,
      username: authUser.username,
      request,
      detail: `Soft delete ref=${existing.referenceNumber}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: 'Gagal menghapus dokumen' }, { status: 500 });
  }
}

// GET /api/documents/:id — fetch single document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const documentId = parseInt(id, 10);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'ID dokumen tidak valid' }, { status: 400 });
    }

    const doc = await db.document.findUnique({
      where: { id: documentId },
      include: {
        attachments: true,
        bookmarks: { where: { userId: authUser.id }, select: { id: true } },
      },
    });
    if (!doc) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    }

    // Log VIEW action
    await logAction({
      action: 'VIEW',
      documentId: doc.id,
      documentTitle: doc.title,
      userId: authUser.id,
      username: authUser.username,
      request,
    });

    return NextResponse.json(transformDoc(doc));
  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json({ error: 'Gagal mengambil dokumen' }, { status: 500 });
  }
}
