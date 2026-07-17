import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// GET /api/me - Get current user from JWT token
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: 'Tidak terautentikasi' },
      { status: 401 }
    );
  }

  // Return user data directly (flat object) to match frontend expectations
  return NextResponse.json({
    id: authUser.id,
    username: authUser.username,
    role: authUser.role,
  });
}
