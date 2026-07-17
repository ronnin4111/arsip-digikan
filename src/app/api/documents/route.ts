import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { uploadPdf } from '@/lib/blob';

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

// GET /api/documents - List documents with filters
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const type = searchParams.get('type') || '';
    const date = searchParams.get('date') || '';
    const seksi = searchParams.get('seksi') || '';

    const where: Record<string, unknown> = {};

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { referenceNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = category;
    if (type) where.type = type;
    if (date) where.date = date;
    if (seksi) where.seksi = seksi;

    const documents = await db.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    const referenceNumber = (formData.get('reference_number') as string) || (formData.get('referenceNumber') as string);
    const category = formData.get('category') as string;
    const sender = (formData.get('sender') as string) || '';
    const recipient = (formData.get('recipient') as string) || '';
    const date = formData.get('date') as string;
    const seksi = (formData.get('seksi') as string) || '';
    const file = (formData.get('pdf') as File | null) || (formData.get('file') as File | null);

    if (!type || !title || !referenceNumber || !category || !date) {
      return NextResponse.json({ error: 'Field wajib belum lengkap' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'File PDF wajib diunggah' }, { status: 400 });
    }

    // Upload PDF to Vercel Blob
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const blobUrl = await uploadPdf(uniqueFilename, buffer);

    // Create document record (pdfFilename now stores the blob URL)
    const document = await db.document.create({
      data: {
        type,
        title,
        referenceNumber,
        category,
        sender,
        recipient,
        date,
        pdfFilename: blobUrl,
        seksi,
        createdBy: authUser.id,
      },
    });

    // Create log entry
    await db.log.create({
      data: {
        action: 'UPLOAD',
        documentId: document.id,
        documentTitle: document.title,
        userId: authUser.id,
        username: authUser.username,
      },
    });

    return NextResponse.json({ id: document.id }, { status: 201 });
  } catch (error) {
    console.error('Upload document error:', error);
    return NextResponse.json({ error: 'Gagal mengunggah dokumen' }, { status: 500 });
  }
}
