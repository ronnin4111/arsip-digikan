-- AlterTable: add physicalLocation column for tracking where the physical paper archive is stored.
-- Nullable so existing rows are unaffected.
-- Use IF NOT EXISTS for idempotency / safety against partial-state DBs.
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "physical_location" TEXT;
