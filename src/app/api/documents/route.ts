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

// GET /api/documents - List documents with filters
// Supports: q (title/ref OR text_content), type, category, date (single), dateFrom, dateTo, seksi, status, includeTrash, bookmarkedOnly
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const category = searchParams.get('category') || '';
    const type = searchParams.get('type') || '';
    const date = searchParams.get('date') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const seksi = searchParams.get('seksi') || '';
    const status = searchParams.get('status') || '';
    const includeTrash = searchParams.get('includeTrash') === 'true';
    const bookmarkedOnly = searchParams.get('bookmarkedOnly') === 'true';
    const bookmarkedBy = searchParams.get('bookmarkedBy'); // user id

    const where: Record<string, unknown> = {};

    // Soft-delete filter
    if (!includeTrash) {
      where.deletedAt = null;
    } else {
      where.deletedAt = { not: null };
    }

    // Full-text search: title, reference_number, OR text_content
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { referenceNumber: { contains: q, mode: 'insensitive' } },
        { textContent: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;
    if (type) where.type = type;
    if (seksi) where.seksi = seksi;
    if (status) where.status = status;

    // Date filters
    if (date) {
      where.date = date;
    } else if (dateFrom || dateTo) {
      const dateFilter: Record<string, string> = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;
      where.date = dateFilter;
    }

    // Bookmarks
    if (bookmarkedOnly || bookmarkedBy) {
      const userId = bookmarkedBy ? Number(bookmarkedBy) : authUser.id;
      where.bookmarks = { some: { userId } };
    }

    const documents = await db.document.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        attachments: true,
        bookmarks: { where: { userId: authUser.id }, select: { id: true } },
      },
    });

    return NextResponse.json(documents.map(transformDoc));
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data dokumen' }, { status: 500 });
  }
}

// POST /api/documents - Upload new document with PDF
export async function POST(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const type = formData.get('type') as string;
    const title = formData.get('title') as string;
    const referenceNumber = ((formData.get('reference_number') as string) || (formData.get('referenceNumber') as string) || '').trim();
    const category = formData.get('category') as string;
    const sender = (formData.get('sender') as string) || '';
    const recipient = (formData.get('recipient') as string) || '';
    const date = formData.get('date') as string;
    const seksi = (formData.get('seksi') as string) || '';
    const status = (formData.get('status') as string) || 'DIARSIPKAN';
    const file = (formData.get('pdf') as File | null) || (formData.get('file') as File | null);

    // Additional PDF attachments (multi-file feature)
    const attachmentFiles: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('attachment_') && value instanceof File) {
        attachmentFiles.push(value);
      }
    }

    if (!type || !title || !referenceNumber || !category || !date) {
      return NextResponse.json({ error: 'Field wajib belum lengkap' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'File PDF wajib diunggah' }, { status: 400 });
    }

    // === Duplicate reference number detection ===
    const duplicate = await db.document.findFirst({
      where: { referenceNumber: { equals: referenceNumber, mode: 'insensitive' }, deletedAt: null },
      select: { id: true, title: true, date: true },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: `Nomor surat "${referenceNumber}" sudah terdaftar pada dokumen lain (ID: ${duplicate.id}, tanggal: ${duplicate.date}).`,
          code: 'DUPLICATE_REFERENCE_NUMBER',
          duplicate,
        },
        { status: 409 }
      );
    }

    // Dynamic import - only loads googleapis when actually uploading
    const { uploadPdf } = await import('@/lib/blob');
    const { extractPdfText } = await import('@/lib/pdf-text');

    // Upload main PDF to storage
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const storageRef = await uploadPdf(uniqueFilename, buffer);

    // Extract text from PDF for full-text search
    let textContent: string | null = null;
    try {
      textContent = await extractPdfText(buffer);
      if (textContent && textContent.length > 100000) {
        textContent = textContent.slice(0, 100000); // Cap at 100k chars
      }
    } catch (err) {
      console.warn('PDF text extraction failed:', err);
    }

    // Create document record
    const document = await db.document.create({
      data: {
        type,
        title,
        referenceNumber,
        category,
        sender,
        recipient,
        date,
        pdfFilename: storageRef,
        seksi,
        status,
        textContent,
        createdBy: authUser.id,
      },
    });

    // Upload additional attachments
    for (const attFile of attachmentFiles) {
      try {
        const attUnique = `att-${Date.now()}-${Math.round(Math.random() * 1e9)}-${attFile.name}`;
        const attBuffer = Buffer.from(await attFile.arrayBuffer());
        const attRef = await uploadPdf(attUnique, attBuffer);
        await db.attachment.create({
          data: {
            documentId: document.id,
            filename: attFile.name,
            storageRef: attRef,
            fileSize: attFile.size,
            mimeType: attFile.type || 'application/pdf',
          },
        });
      } catch (err) {
        console.warn(`Failed to upload attachment ${attFile.name}:`, err);
      }
    }

    // Log
    await logAction({
      action: 'UPLOAD',
      documentId: document.id,
      documentTitle: document.title,
      userId: authUser.id,
      username: authUser.username,
      request,
    });

    return NextResponse.json({ id: document.id }, { status: 201 });
  } catch (error) {
    console.error('Upload document error:', error);
    return NextResponse.json({ error: 'Gagal mengunggah dokumen' }, { status: 500 });
  }
}
