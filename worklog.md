---
Task ID: 1-7
Agent: main
Task: Clone and convert arsip-digikan repo from Vite+Express to Next.js 16

Work Log:
- Cloned https://github.com/ronnin4111/arsip-digikan to /home/z/arsip-digikan
- Analyzed original project: Vite + React + Express.js + better-sqlite3 + JWT + Multer
- Set up Prisma schema with User, Document, Log models (mapping snake_case columns to camelCase)
- Seeded admin user (admin_digikan / digikan357)
- Created JWT auth utilities (signToken, verifyToken, getAuthUser)
- Created all API routes: /api/login, /api/me, /api/documents, /api/documents/[id], /api/documents/[id]/preview, /api/documents/[id]/download, /api/logs, /api/users, /api/users/[id], /api/storage-usage
- Created AuthContext for frontend authentication
- Created Login page with banner image
- Created Dashboard page with stats, filters, document table, preview/edit/delete modals, logs modal, user management modal
- Created Upload Document page with PDF upload support
- Wired up main page.tsx with view switching between login/dashboard/upload
- Fixed API response formats to match frontend expectations (flat arrays, snake_case field names)
- Fixed PDF preview authentication for iframes (token as query parameter)
- All lint checks pass
- Browser verification completed: login, dashboard, upload, preview, edit, delete, logs, user management all working

Stage Summary:
- Full arsip-digikan app successfully converted to Next.js 16
- All original features preserved: auth, CRUD documents, PDF upload/preview/download, search/filter, activity logs, user management (admin), storage monitoring
- Credentials: admin_digikan / digikan357

---
Task ID: 1+2+3+4+5
Agent: full-stack-developer
Task: Prepare project for Vercel deployment

Work Log:
- Installed @vercel/blob package (v2.6.1) for serverless-compatible file storage
- Switched Prisma datasource from SQLite to PostgreSQL in schema.prisma
- Added onDelete: SetNull to User-Document and User-Log relations for proper cascade behavior
- Added mode: 'insensitive' to search queries for PostgreSQL case-insensitive matching
- Created src/lib/blob.ts helper with uploadPdf, deletePdf, getPdfUrl, isBlobUrl functions
- Updated /api/documents/route.ts POST handler to upload PDFs to Vercel Blob instead of local filesystem
- Updated /api/documents/[id]/route.ts DELETE handler to delete blobs via Vercel Blob instead of fs.unlinkSync
- Updated /api/documents/[id]/preview/route.ts to redirect to blob URLs instead of reading local files
- Updated /api/documents/[id]/download/route.ts to redirect to blob URLs instead of streaming local files
- Updated /api/storage-usage/route.ts to estimate storage via document count instead of local filesystem scanning
- Updated src/lib/db.ts to remove query logging for production serverless
- Created .env.example with required Vercel environment variables (DATABASE_URL, BLOB_READ_WRITE_TOKEN, JWT_SECRET)
- Updated next.config.ts with images.remotePatterns for *.vercel-storage.com domain
- Created vercel.json with build command, install command, framework, and region settings
- Updated package.json build script to include prisma generate, added postinstall script for Vercel
- Verified all filesystem (fs/path) imports removed from src/ directory
- All lint checks pass with zero errors

Stage Summary:
- Project fully prepared for Vercel serverless deployment
- SQLite → PostgreSQL (compatible with Vercel Postgres/Neon)
- Local filesystem uploads → Vercel Blob storage
- PDF preview/download now redirect to public blob URLs
- Storage usage estimated from document count (no local filesystem access)
- No remaining fs/path imports in application code
- Required env vars documented in .env.example
- Note: Local dev will not work until DATABASE_URL points to a PostgreSQL instance
