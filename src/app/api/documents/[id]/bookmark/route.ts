import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// POST /api/documents/[id]/bookmark - toggle bookmark
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

  const existing = await db.bookmark.findUnique({
    where: { userId_documentId: { userId: authUser.id, documentId } },
  });

  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } });
    return NextResponse.json({ bookmarked: false });
  } else {
    await db.bookmark.create({ data: { userId: authUser.id, documentId } });
    return NextResponse.json({ bookmarked: true });
  }
}

// GET /api/documents/[id]/bookmark - check bookmark status
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

  const existing = await db.bookmark.findUnique({
    where: { userId_documentId: { userId: authUser.id, documentId } },
  });
  return NextResponse.json({ bookmarked: !!existing });
}
