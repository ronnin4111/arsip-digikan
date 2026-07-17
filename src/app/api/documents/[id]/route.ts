import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// Helper to transform Prisma document to match frontend expectations
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

// PUT /api/documents/:id - Update document metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
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

    const existing = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan' },
        { status: 404 }
      );
    }

    const body = await request.json();
    // Frontend sends snake_case fields, convert to camelCase for Prisma
    const {
      type,
      title,
      reference_number,
      referenceNumber,
      category,
      sender,
      recipient,
      date,
      seksi,
    } = body;

    const refNum = reference_number || referenceNumber;

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

    // Create log entry
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
    return NextResponse.json(
      { error: 'Gagal memperbarui dokumen' },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/:id - Delete document and PDF file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = getAuthUser(request);
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

    const existing = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan' },
        { status: 404 }
      );
    }

    // Delete PDF file from uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, existing.pdfFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Nullify documentId in related logs before deleting document
    await db.log.updateMany({
      where: { documentId: documentId },
      data: { documentId: null },
    });

    // Delete document from database
    await db.document.delete({
      where: { id: documentId },
    });

    // Create log entry (documentId is null since document is deleted)
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
    return NextResponse.json(
      { error: 'Gagal menghapus dokumen' },
      { status: 500 }
    );
  }
}
