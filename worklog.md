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
