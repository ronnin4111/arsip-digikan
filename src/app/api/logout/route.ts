import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { logAction } from '@/lib/log';

// POST /api/logout - record logout event
export async function POST(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (authUser) {
    await logAction({
      action: 'LOGOUT',
      userId: authUser.id,
      username: authUser.username,
      request,
    });
  }
  return NextResponse.json({ success: true });
}
