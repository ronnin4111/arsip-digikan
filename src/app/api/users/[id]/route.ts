import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// PUT /api/users/:id - Update user (admin only)
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

  if (authUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Akses ditolak. Hanya admin yang diizinkan.' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID pengguna tidak valid' },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { username, role, password } = body;

    const updateData: Record<string, unknown> = {};
    if (username !== undefined) updateData.username = username;
    if (role !== undefined) updateData.role = role;
    if (password) {
      updateData.passwordHash = bcrypt.hashSync(password, 10);
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui pengguna' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/:id - Delete user (admin only, cannot delete self)
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

  if (authUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Akses ditolak. Hanya admin yang diizinkan.' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID pengguna tidak valid' },
        { status: 400 }
      );
    }

    if (userId === authUser.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus akun sendiri' },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      );
    }

    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus pengguna' },
      { status: 500 }
    );
  }
}
