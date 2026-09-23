-- CreateTable: settings (key-value store for runtime-configurable secrets like GOOGLE_REFRESH_TOKEN)
CREATE TABLE IF NOT EXISTS "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
