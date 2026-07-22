import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

export interface JwtPayload {
  id: number;
  username: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  // 1) Preferred: Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  // 2) Fallback: ?token=<token> query param.
  //    Needed for browser-issued requests that can't set headers — e.g. <img>,
  //    <iframe>, and <a download>. Without this, QR codes and inline PDF
  //    previews would always 401 because the browser sends no Authorization
  //    header on those element types.
  const tokenQuery = request.nextUrl?.searchParams?.get('token');
  if (tokenQuery) return tokenQuery;
  return null;
}

export function getAuthUser(request: NextRequest): JwtPayload | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}
