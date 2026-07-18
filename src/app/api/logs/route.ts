import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// Helper to transform Prisma log to match frontend expectations
function transformLog(log: any) {
  return {
    id: log.id,
    action: log.action,
    document_id: log.documentId,
    document_title: log.documentTitle,
    user_id: log.userId,
    username: log.username,
    timestamp: log.timestamp,
  };
}

// GET /api/logs - Get activity logs (last 100)
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: 'Tidak terautentikasi' },
      { status: 401 }
    );
  }

  try {
    const logs = await db.log.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    // Return flat array with snake_case fields
    return NextResponse.json(logs.map(transformLog));
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data log' },
      { status: 500 }
    );
  }
}
