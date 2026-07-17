import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET /api/users - List all users (admin only)
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: 'Tidak terautentikasi' },
      { status: 401 }
    );
  }

  if (authUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Akses ditolak. Hanya admin yang diizinkan.' },
      { status: 403 }
    );
  }

  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
      },
      orderBy: { id: 'asc' },
    });

    // Return flat array to match frontend expectations
    return NextResponse.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data pengguna' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: 'Tidak terautentikasi' },
      { status: 401 }
    );
  }

  if (authUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Akses ditolak. Hanya admin yang diizinkan.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { username, password, role } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await db.user.findUnique({
      where: { username },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Username sudah digunakan' },
        { status: 400 }
      );
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const user = await db.user.create({
      data: {
        username,
        passwordHash,
        role: role || 'user',
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat pengguna baru' },
      { status: 500 }
    );
  }
}
