-- AlterTable: add physicalLocation column for tracking where the physical paper archive is stored.
-- Nullable so existing rows are unaffected.
ALTER TABLE "documents" ADD COLUMN "physical_location" TEXT;
