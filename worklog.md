---
Task ID: 1
Agent: Main Agent
Task: Fix 500 error on /api/documents endpoint

Work Log:
- Diagnosed root cause: googleapis module was eagerly imported at top level, causing OOM crashes and 500 errors
- Refactored google-drive.ts to use dynamic imports for googleapis and google-auth-library
- Refactored blob.ts to use dynamic imports for all Google Drive functions
- Removed uploadPdf import from documents GET handler (only needed in POST)
- Updated all API routes (documents, [id], preview, download, storage-usage) to use lazy loading
- Discovered Google Drive upload fails with 403: "Service Accounts do not have storage quota"
- Added supportsAllDrives: true to all Google Drive API calls
- Implemented Vercel Blob fallback when Google Drive upload fails
- Added /api/drive-status endpoint for Google Drive diagnostics
- Added warning banner in Dashboard when Google Drive needs Shared Drive setup
- Fixed Buffer to Readable stream conversion for Google Drive uploads
- All production API endpoints verified working on Vercel

Stage Summary:
- 500 error fixed by lazy-loading googleapis module
- Google Drive upload requires Shared Drive (personal folders don't work with Service Accounts)
- Vercel Blob acts as automatic fallback for uploads
- Dashboard shows clear setup instructions for migrating to Shared Drive
- Production deployment at https://arsip-digikan.vercel.app is fully functional
