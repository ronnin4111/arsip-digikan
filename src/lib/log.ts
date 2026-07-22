import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export interface LogActionParams {
  action: string;
  documentId?: number | null;
  documentTitle?: string | null;
  userId?: number | null;
  username?: string | null;
  request?: NextRequest;
  detail?: string | null;
}

/**
 * Centralized audit log helper.
 * Captures IP address (X-Forwarded-For) and writes a row to the logs table.
 * Never throws — failures are silently logged to console.
 */
export async function logAction({
  action,
  documentId = null,
  documentTitle = null,
  userId = null,
  username = null,
  request,
  detail = null,
}: LogActionParams): Promise<void> {
  try {
    let ip: string | null = null;
    if (request) {
      const xff = request.headers.get('x-forwarded-for');
      if (xff) ip = xff.split(',')[0].trim();
      else ip = request.headers.get('x-real-ip');
    }

    await db.log.create({
      data: {
        action,
        documentId,
        documentTitle,
        userId,
        username,
        ip,
        detail,
      },
    });
  } catch (err) {
    console.error('logAction failed:', err);
  }
}
