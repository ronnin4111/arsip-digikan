---
Task ID: 1
Agent: Main Agent
Task: Fix Google Drive integration - files not saving to user's personal Drive

Work Log:
- Analyzed the root cause: Service Account cannot upload to personal Drive folders (only Shared Drives)
- User tried OAuth2 Playground but got Error 403: access_denied (consent screen not configured)
- Added GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env (from user's uploaded OAuth credentials file)
- Created built-in OAuth2 callback endpoint at /api/auth/google/callback/route.ts
- Updated /api/auth/google/route.ts to support both built-in and Playground OAuth flows
- Created /api/drive-test/route.ts diagnostic endpoint that tests folder access and upload capability
- Created DriveSetup.tsx component with 4-step OAuth2 setup guide:
  1. Configure OAuth consent screen (External + add email as test user)
  2. Add redirect URI to OAuth client
  3. Authorize Google Drive access
  4. Save refresh token in Vercel
- Updated DashboardPage.tsx to integrate DriveSetup component (shown to admin users)
- Added detailed error logging to blob.ts upload flow
- Fixed .env file: converted multiline GOOGLE_PRIVATE_KEY to single-line with \n escapes
- Found and documented DATABASE_URL shell env override issue (won't affect Vercel deployment)

Stage Summary:
- Root cause identified: Service Account can't upload to personal Drive, need OAuth2 with refresh token
- Complete OAuth2 setup flow built into the app (no more need for OAuth Playground)
- DriveSetup component provides step-by-step instructions with interactive code exchange
- User needs to: configure OAuth consent screen → authorize → save refresh token in Vercel
- On Vercel, set env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
- After adding GOOGLE_REFRESH_TOKEN, OAuth2 takes priority over Service Account and uploads will work
