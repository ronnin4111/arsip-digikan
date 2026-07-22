import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { isBlobUrl } from '@/lib/blob';
import { isGoogleDriveFileId } from '@/lib/google-drive';

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
    created_at: doc.createdAt,
    created_by: doc.createdBy,
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
    const { type, title, reference_number, referenceNumber, category, sender, recipient, date, seksi } = body;
    const refNum = (reference_number || referenceNumber || '').trim();

    // === Duplicate reference number detection (skip current document) ===
    if (refNum) {
      const dup = await db.document.findFirst({
        where: {
          referenceNumber: { equals: refNum, mode: 'insensitive' },
          id: { not: documentId },
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
        ...(refNum !== undefined && { referenceNumber: refNum }),
        ...(category !== undefined && { category }),
        ...(sender !== undefined && { sender }),
        ...(recipient !== undefined && { recipient }),
        ...(date !== undefined && { date }),
        ...(seksi !== undefined && { seksi }),
      },
    });

    await db.log.create({
      data: {
        action: 'UPDATE',
        documentId: updated.id,
        documentTitle: updated.title,
        userId: authUser.id,
        username: authUser.username,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui dokumen' }, { status: 500 });
  }
}

// DELETE /api/documents/:id
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

    // Delete PDF from storage (Google Drive or Vercel Blob)
    // Use dynamic import to avoid loading googleapis eagerly
    if (isGoogleDriveFileId(existing.pdfFilename) || isBlobUrl(existing.pdfFilename)) {
      try {
        const { deletePdf } = await import('@/lib/blob');
        await deletePdf(existing.pdfFilename);
      } catch (e) {
        console.error('Failed to delete file from storage:', e);
      }
    }

    // Nullify documentId in related logs
    await db.log.updateMany({
      where: { documentId: documentId },
      data: { documentId: null },
    });

    await db.document.delete({ where: { id: documentId } });

    await db.log.create({
      data: {
        action: 'DELETE',
        documentId: null,
        documentTitle: existing.title,
        userId: authUser.id,
        username: authUser.username,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json({ error: 'Gagal menghapus dokumen' }, { status: 500 });
  }
}
