import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    hasDbUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    hasGoogleEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    hasGoogleKey: !!process.env.GOOGLE_PRIVATE_KEY,
    hasGoogleFolder: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    nodeEnv: process.env.NODE_ENV,
  });
}
