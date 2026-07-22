-- Migration: add new columns and tables for soft delete, status, full-text search, attachments, bookmarks, audit fields
-- All changes are additive (nullable / default) so existing data is preserved

-- 1. Add columns to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DIARSIPKAN',
  ADD COLUMN IF NOT EXISTS text_content TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 2. Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_document_id ON attachments(document_id);

-- 3. Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);

-- 4. Add audit columns to logs
ALTER TABLE logs
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS detail TEXT;
CREATE INDEX IF NOT EXISTS idx_logs_action ON logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);

-- 5. Backfill status for existing rows
UPDATE documents SET status = 'DIARSIPKAN' WHERE status IS NULL;
