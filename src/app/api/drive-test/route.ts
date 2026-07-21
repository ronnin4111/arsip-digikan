import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/drive-test
 * Tests Google Drive connection and provides diagnostic information.
 * Checks:
 * 1. Which auth method is configured (OAuth2 or Service Account)
 * 2. If the folder is accessible
 * 3. If uploads work (tries to upload a small test file)
 * 4. Provides actionable error messages
 */
export async function GET(request: NextRequest) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  const result: {
    configured: boolean;
    authMethod: 'oauth2' | 'service-account' | 'none';
    folderId: string;
    folderAccessible: boolean;
    folderName?: string;
    isInSharedDrive?: boolean;
    canUpload: boolean;
    uploadError?: string;
    existingFileCount?: number;
    errors: string[];
    warnings: string[];
    instructions: string[];
  } = {
    configured: false,
    authMethod: 'none',
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    folderAccessible: false,
    canUpload: false,
    errors: [],
    warnings: [],
    instructions: [],
  };

  // Check which auth method is configured
  const hasOAuth2 = !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
  const hasServiceAccount = !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
  const hasFolderId = !!process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (hasOAuth2) {
    result.authMethod = 'oauth2';
    result.configured = true;
  } else if (hasServiceAccount) {
    result.authMethod = 'service-account';
    result.configured = !!hasFolderId;
  }

  if (!hasFolderId) {
    result.errors.push('GOOGLE_DRIVE_FOLDER_ID belum diset.');
    result.instructions.push('Set GOOGLE_DRIVE_FOLDER_ID dengan ID folder Google Drive Anda.');
  }

  if (!result.configured) {
    result.errors.push('Google Drive belum dikonfigurasi. Diperlukan OAuth2 atau Service Account.');
    result.instructions.push('Setup OAuth2 dengan refresh token (direkomendasikan untuk akun Gmail pribadi).');
    return NextResponse.json(result);
  }

  // Test Google Drive connection
  try {
    const { google } = await import('googleapis');
    let drive;

    if (result.authMethod === 'oauth2') {
      const { OAuth2Client } = await import('google-auth-library');
      const client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });
      drive = google.drive({
        version: 'v3',
        auth: client as unknown as Parameters<typeof google.drive>[0]['auth'],
      });
    } else {
      const { JWT } = await import('google-auth-library');
      const auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      drive = google.drive({
        version: 'v3',
        auth: auth as unknown as Parameters<typeof google.drive>[0]['auth'],
      });
    }

    // Test 1: Check folder accessibility
    try {
      const folderRes = await drive.files.get({
        fileId: result.folderId,
        fields: 'id,name,mimeType,driveId,capabilities',
        supportsAllDrives: true,
      });

      const folderData = folderRes.data as Record<string, unknown>;
      result.folderAccessible = true;
      result.folderName = (folderData.name as string) || '';
      const driveId = folderData.driveId as string | undefined;
      result.isInSharedDrive = !!driveId;
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      result.folderAccessible = false;
      result.errors.push(`Folder tidak dapat diakses: ${err.message || 'Unknown error'} (code: ${err.code})`);

      if (err.code === 404) {
        result.instructions.push('Folder ID tidak ditemukan. Pastikan GOOGLE_DRIVE_FOLDER_ID benar.');
        result.instructions.push('Pastikan Service Account email telah ditambahkan sebagai editor di folder tersebut.');
      } else if (err.code === 403) {
        result.instructions.push('Akses ditolak. Pastikan akun/service account memiliki akses ke folder ini.');
        if (result.authMethod === 'service-account') {
          result.instructions.push(`Share folder dengan email: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
        }
      }
    }

    // Test 2: List existing files
    try {
      const listRes = await drive.files.list({
        q: `'${result.folderId}' in parents and trashed = false`,
        fields: 'files(id, name, size)',
        pageSize: 10,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const files = (listRes.data.files || []) as Array<Record<string, string>>;
      result.existingFileCount = files.length;
    } catch (error: unknown) {
      const err = error as { message?: string };
      result.warnings.push(`Tidak dapat membaca daftar file: ${err.message || 'Unknown error'}`);
    }

    // Test 3: Try uploading a small test file
    try {
      const { Readable } = await import('stream');
      const testContent = `Arsip-Digikan Drive Test - ${new Date().toISOString()}`;
      const testBuffer = Buffer.from(testContent, 'utf-8');
      const testStream = Readable.from(testBuffer);
      const testFilename = `_test_${Date.now()}.txt`;

      const uploadRes = await drive.files.create({
        requestBody: {
          name: testFilename,
          parents: [result.folderId],
          mimeType: 'text/plain',
        },
        media: {
          mimeType: 'text/plain',
          body: testStream,
        },
        fields: 'id',
        supportsAllDrives: true,
      });

      if (uploadRes.data.id) {
        result.canUpload = true;
        // Clean up: delete the test file
        try {
          await drive.files.delete({
            fileId: uploadRes.data.id,
            supportsAllDrives: true,
          });
        } catch {
          // Ignore cleanup error
        }
      } else {
        result.canUpload = false;
        result.errors.push('Upload test gagal: tidak ada file ID yang dikembalikan.');
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string; errors?: Array<{ message?: string; reason?: string }> };
      result.canUpload = false;

      let errorMsg = err.message || 'Unknown error';
      if (err.errors && err.errors.length > 0) {
        errorMsg = err.errors.map(e => `${e.reason}: ${e.message}`).join('; ');
      }

      result.uploadError = `Upload gagal (code ${err.code}): ${errorMsg}`;

      if (result.authMethod === 'service-account' && !result.isInSharedDrive) {
        result.errors.push('Service Account tidak bisa upload ke folder di My Drive (personal).');
        result.instructions.push('Solusi: Gunakan OAuth2 dengan refresh token (direkomendasikan untuk akun Gmail pribadi).');
        result.instructions.push('Atau: Buat Shared Drive dan tambahkan Service Account sebagai member.');
      } else if (err.code === 403) {
        result.errors.push('Permission denied saat upload. Pastikan akun memiliki akses editor ke folder.');
      } else if (err.code === 404) {
        result.errors.push('Folder tidak ditemukan saat upload. Pastikan folder ID benar.');
      }
    }

    // Generate appropriate instructions based on status
    if (result.canUpload) {
      result.instructions.push('Google Drive terhubung dengan baik! File akan disimpan ke Google Drive Anda.');
    } else if (result.authMethod === 'service-account' && !result.isInSharedDrive) {
      result.warnings.push('Service Account tidak bisa upload ke folder personal Drive.');
      result.instructions.push('Saran: Setup OAuth2 dengan refresh token agar bisa upload ke personal Drive.');
    }

  } catch (error: unknown) {
    const err = error as { message?: string; code?: number };
    result.errors.push(`Gagal terhubung ke Google Drive API: ${err.message || 'Unknown error'}`);
    result.instructions.push('Pastikan Google Drive API sudah di-enable di Google Cloud Console.');
  }

  return NextResponse.json(result);
}
