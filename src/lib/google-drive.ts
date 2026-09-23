/**
 * Google Drive integration for document storage.
 *
 * Supports TWO authentication methods:
 *
 * 1. OAuth2 with Refresh Token (RECOMMENDED for personal Gmail accounts)
 *    - Works with personal @gmail.com accounts
 *    - Files are stored using your personal Drive's 15GB quota
 *    - Refresh token can be stored either:
 *      a) In DB (table `settings`, key `GOOGLE_REFRESH_TOKEN`) — runtime-configurable via OAuth flow
 *      b) In env var `GOOGLE_REFRESH_TOKEN` — fallback for legacy deployments
 *    - Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (+ optional GOOGLE_REFRESH_TOKEN)
 *
 * 2. Service Account (REQUIRES Shared Drive / Google Workspace)
 *    - Service Accounts have NO storage quota
 *    - Can ONLY upload to Shared Drives, NOT personal folders
 *    - Env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
 *    - Also requires: GOOGLE_DRIVE_FOLDER_ID pointing to a Shared Drive folder
 *
 * Fallback: If Google Drive upload fails, Vercel Blob is used (250MB free)
 */

/**
 * Dynamic import of Prisma client (lazy-loaded so this module doesn't pull in
 * the entire Prisma client at startup — preserving the lazy-loading pattern
 * this file already uses for googleapis).
 */
async function getDb() {
  const { db } = await import('./db');
  return db;
}

// Types for lazy-loaded modules
type AuthClientType = import('google-auth-library').JWT | import('google-auth-library').OAuth2Client;
type DriveType = import('googleapis').drive_v3.Drive;

// Lazy-initialized instances (not loaded until first use)
// NOTE: invalidated by invalidateDriveCache() whenever refresh token changes
let authClient: AuthClientType | null = null;
let driveInstance: DriveType | null = null;

/**
 * In-memory cache of settings to avoid hitting DB on every Drive call.
 * TTL: 30 seconds (refresh tokens don't change often, but we want quick
 * pick-up when user re-authorizes via OAuth flow).
 */
let settingsCache: Record<string, string> = {};
let settingsCacheAt = 0;
const SETTINGS_CACHE_TTL_MS = 30_000;

export async function getSetting(key: string): Promise<string | undefined> {
  const now = Date.now();
  if (now - settingsCacheAt > SETTINGS_CACHE_TTL_MS) {
    settingsCache = {};
    settingsCacheAt = now;
  }
  if (key in settingsCache) {
    const cached = settingsCache[key];
    return cached || process.env[key];
  }
  try {
    const db = await getDb();
    const row = await db.setting.findUnique({ where: { key } });
    if (row?.value) {
      settingsCache[key] = row.value;
      return row.value;
    }
    // DB returned null/empty → fall back to env var (e.g. legacy GOOGLE_REFRESH_TOKEN)
    settingsCache[key] = '';
    return process.env[key];
  } catch {
    // DB might not be ready (migration not applied yet) — fall back to env var
    return process.env[key];
  }
}

/**
 * Persist a setting (called by OAuth callback after successful authorization).
 * Also invalidates the in-memory + drive-instance cache so the new token
 * takes effect immediately on the next request.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  settingsCache[key] = value;
  invalidateDriveCache();
}

/**
 * Force the next Drive call to re-create the auth client and Drive instance.
 * Called whenever refresh token (or any auth-related setting) changes.
 */
export function invalidateDriveCache(): void {
  authClient = null;
  driveInstance = null;
  // Force settings cache reload too
  settingsCacheAt = 0;
}

/**
 * Check if OAuth2 with refresh token is configured (DB or env var)
 */
async function isOAuth2ConfiguredAsync(): Promise<boolean> {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    (await getSetting('GOOGLE_REFRESH_TOKEN'))
  );
}

/**
 * Sync version for places where we cannot await (e.g. drive-status route
 * does its own async check). Checks env var only.
 */
function isOAuth2ConfiguredFromEnv(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

/**
 * Check if Service Account is configured
 */
function isServiceAccountConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

async function getAuthClient(): Promise<AuthClientType> {
  if (authClient) return authClient;

  // Priority 1: OAuth2 with refresh token (DB or env var)
  const refreshToken = await getSetting('GOOGLE_REFRESH_TOKEN');
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && refreshToken) {
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    client.setCredentials({
      refresh_token: refreshToken,
    });
    authClient = client;
    return authClient;
  }

  // Priority 2: Service Account (requires Shared Drive)
  if (isServiceAccountConfigured()) {
    const { JWT } = await import('google-auth-library');
    authClient = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return authClient;
  }

  throw new Error(
    'Google Drive not configured. Set either OAuth2 vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) or Service Account vars (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).'
  );
}

async function getDrive(): Promise<DriveType> {
  if (driveInstance) return driveInstance;
  const auth = await getAuthClient();

  const { google } = await import('googleapis');

  driveInstance = google.drive({
    version: 'v3',
    auth: auth as unknown as Parameters<typeof google.drive>[0]['auth'],
  });

  return driveInstance;
}

async function getFolderIdAsync(): Promise<string> {
  // Prefer DB setting, fall back to env var
  const folderId = (await getSetting('GOOGLE_DRIVE_FOLDER_ID')) || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set (neither in DB nor env var).');
  }
  return folderId;
}

/**
 * Check if Google Drive is configured (any method)
 * Async version: considers DB-stored refresh token.
 */
export async function isGoogleDriveConfiguredAsync(): Promise<boolean> {
  const folderId = (await getSetting('GOOGLE_DRIVE_FOLDER_ID')) || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return false;
  return (await isOAuth2ConfiguredAsync()) || isServiceAccountConfigured();
}

/**
 * Sync version (env-var only) — kept for backward compatibility.
 * Prefer isGoogleDriveConfiguredAsync() in route handlers.
 */
export function isGoogleDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
    (isOAuth2ConfiguredFromEnv() || isServiceAccountConfigured())
  );
}

/**
 * Get the authentication method being used (async — considers DB)
 */
export async function getAuthMethodAsync(): Promise<'oauth2' | 'service-account' | 'none'> {
  if (await isOAuth2ConfiguredAsync()) return 'oauth2';
  if (isServiceAccountConfigured()) return 'service-account';
  return 'none';
}

/**
 * Sync version (env-var only) — kept for backward compatibility.
 */
export function getAuthMethod(): 'oauth2' | 'service-account' | 'none' {
  if (isOAuth2ConfiguredFromEnv()) return 'oauth2';
  if (isServiceAccountConfigured()) return 'service-account';
  return 'none';
}

/**
 * Check if a string is a Google Drive file ID
 */
export function isGoogleDriveFileId(value: string): boolean {
  if (!value) return false;
  return !value.startsWith('http') && !value.includes('/') && !value.includes('.');
}

/**
 * Upload a PDF file to Google Drive
 */
export async function uploadToDrive(filename: string, buffer: Buffer): Promise<string> {
  const drive = await getDrive();
  const folderId = await getFolderIdAsync();

  const { Readable } = await import('stream');
  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: 'application/pdf',
    },
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error('Failed to upload file to Google Drive: no file ID returned.');
  }

  return response.data.id;
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = await getDrive();
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });
}

/**
 * Get a file's metadata from Google Drive
 */
export async function getFileInfo(fileId: string): Promise<{ size: number; name: string; mimeType: string } | null> {
  try {
    const drive = await getDrive();
    const response = await drive.files.get({
      fileId,
      fields: 'size,name,mimeType',
      supportsAllDrives: true,
    });
    const data = response.data as Record<string, unknown>;
    return {
      size: parseInt((data.size as string) || '0', 10),
      name: (data.name as string) || '',
      mimeType: (data.mimeType as string) || '',
    };
  } catch (error: unknown) {
    const gerr = error as { code?: number };
    if (gerr.code === 404) return null;
    throw error;
  }
}

/**
 * Generate a viewer link for a file in Google Drive.
 * Sets the file to be viewable by anyone with the link.
 */
export async function getFileViewLink(fileId: string): Promise<string> {
  const drive = await getDrive();

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch {
    // Permission might already exist
  }

  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Get the direct download URL for a Google Drive file
 */
export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const drive = await getDrive();

  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch {
    // Permission might already exist
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Download a file from Google Drive
 */
export async function downloadFromDrive(fileId: string): Promise<Buffer> {
  const drive = await getDrive();

  const response = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * Get storage usage info for the Google Drive folder.
 */
export async function getDriveStorageInfo(): Promise<{ usedBytes: number; limitBytes: number }> {
  const files = await listDriveFiles();
  const usedBytes = files.reduce((sum, file) => sum + file.size, 0);

  // Google Drive free tier is 15GB
  const limitBytes = 15 * 1024 * 1024 * 1024; // 15 GB

  return { usedBytes, limitBytes };
}

/**
 * List all files in the configured Google Drive folder
 */
export async function listDriveFiles(): Promise<Array<{ id: string; name: string; size: number }>> {
  const drive = await getDrive();
  const folderId = await getFolderIdAsync();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, size)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = (response.data.files || []) as Array<Record<string, string>>;
  return files.map((file) => ({
    id: file.id || '',
    name: file.name || '',
    size: parseInt(file.size || '0', 10),
  }));
}
