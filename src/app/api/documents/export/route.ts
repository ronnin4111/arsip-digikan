import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logAction } from '@/lib/log';

// GET /api/documents/export - export documents to xlsx/csv
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    const q = (searchParams.get('q') || '').trim();
    const category = searchParams.get('category') || '';
    const type = searchParams.get('type') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const seksi = searchParams.get('seksi') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = { deletedAt: null };
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

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, string> = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;
      where.date = dateFilter;
    }

    const documents = await db.document.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const TYPE_LABEL: Record<string, string> = {
      INCOMING: 'Surat Masuk',
      OUTGOING: 'Surat Keluar',
      SURAT_TUGAS: 'Surat Tugas',
      SURAT_KEPUTUSAN: 'Surat Keputusan',
    };

    const rows = documents.map((d) => ({
      'Tipe': TYPE_LABEL[d.type] || d.type,
      'Judul': d.title,
      'No. Referensi': d.referenceNumber,
      'Kategori': d.category,
      'Seksi': d.seksi,
      'Status': d.status,
      'Pengirim': d.sender,
      'Penerima': d.recipient,
      'Tanggal': d.date,
      'Dibuat Pada': new Date(d.createdAt).toLocaleString('id-ID'),
    }));

    if (format === 'csv') {
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      const escape = (v: unknown) => {
        const s = String(v ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      const csv = [
        cols.join(','),
        ...rows.map((r) => cols.map((c) => escape(r[c as keyof typeof r])).join(',')),
      ].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="arsip-digikan-${Date.now()}.csv"`,
        },
      });
    }

    // Default: xlsx
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    // Set column widths
    ws['!cols'] = [
      { wch: 14 }, { wch: 40 }, { wch: 22 }, { wch: 12 }, { wch: 28 },
      { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Arsip');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    await logAction({
      action: 'DOWNLOAD',
      documentTitle: null,
      userId: authUser.id,
      username: authUser.username,
      request,
      detail: `Export ${documents.length} documents to ${format.toUpperCase()}`,
    });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="arsip-digikan-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Gagal export data' }, { status: 500 });
  }
}
