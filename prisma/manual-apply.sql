-- ============================================================
-- MANUAL APPLY SCRIPT
-- Run this in Supabase SQL Editor (all at once).
-- Uses IF NOT EXISTS / IF EXISTS everywhere so it is safe
-- to run multiple times without errors.
-- ============================================================

-- ─── 1. Enums (skip if already exist) ────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "BookingUnit" AS ENUM ('NIGHT', 'HOUR', 'DAY', 'SESSION', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ResourceLifecycleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ResourceOperationalStatus" AS ENUM ('READY', 'DIRTY', 'OCCUPIED', 'INSPECTION', 'MAINTENANCE', 'OUT_OF_SERVICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ResourceMarketplaceVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. resource_types ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "resource_types" (
  "id"               TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "description"      TEXT,
  "default_bookable" BOOLEAN NOT NULL DEFAULT true,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resource_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resource_types_code_key" ON "resource_types"("code");

-- Seed resource types (skip duplicates)
INSERT INTO "resource_types" ("id","code","name","description","default_bookable") VALUES
  ('rtype_accommodation',     'ACCOMMODATION',      'Accommodation',      'Rooms, suites, apartments and other sleeping accommodation', true),
  ('rtype_hospitality_space', 'HOSPITALITY_SPACE',  'Hospitality Space',  'VIP lounges, private dining rooms and other hospitality spaces', true),
  ('rtype_event_space',       'EVENT_SPACE',         'Event Space',        'Conference rooms, event halls and other bookable event spaces', true),
  ('rtype_scheduled_facility','SCHEDULED_FACILITY', 'Scheduled Facility', 'Spa treatment rooms, pool sessions and other scheduled slots', true),
  ('rtype_general_facility',  'GENERAL_FACILITY',   'General Facility',   'Non-bookable facilities such as gym, shared pool, lobby', false)
ON CONFLICT DO NOTHING;

-- ─── 3. resource_categories ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "resource_categories" (
  "id"                               TEXT NOT NULL,
  "hotel_id"                         TEXT NOT NULL,
  "resource_type_id"                 TEXT NOT NULL,
  "name"                             TEXT NOT NULL,
  "code"                             TEXT NOT NULL,
  "description"                      TEXT,
  "default_booking_unit"             "BookingUnit" NOT NULL DEFAULT 'NIGHT',
  "default_capacity"                 INTEGER,
  "default_minimum_duration_minutes" INTEGER,
  "default_maximum_duration_minutes" INTEGER,
  "is_active"                        BOOLEAN NOT NULL DEFAULT true,
  "created_at"                       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resource_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resource_categories_hotel_id_code_key"
  ON "resource_categories"("hotel_id","code");
CREATE INDEX IF NOT EXISTS "resource_categories_hotel_id_resource_type_id_idx"
  ON "resource_categories"("hotel_id","resource_type_id");

DO $$ BEGIN
  ALTER TABLE "resource_categories"
    ADD CONSTRAINT "resource_categories_hotel_id_fkey"
      FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "resource_categories"
    ADD CONSTRAINT "resource_categories_resource_type_id_fkey"
      FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4. buildings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "buildings" (
  "id"         TEXT NOT NULL,
  "hotel_id"   TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "buildings_hotel_id_code_key"
  ON "buildings"("hotel_id","code");

DO $$ BEGIN
  ALTER TABLE "buildings"
    ADD CONSTRAINT "buildings_hotel_id_fkey"
      FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5. floors ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "floors" (
  "id"           TEXT NOT NULL,
  "hotel_id"     TEXT NOT NULL,
  "building_id"  TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "level_number" INTEGER NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "floors_hotel_id_building_id_idx"
  ON "floors"("hotel_id","building_id");

DO $$ BEGIN
  ALTER TABLE "floors"
    ADD CONSTRAINT "floors_hotel_id_fkey"
      FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "floors"
    ADD CONSTRAINT "floors_building_id_fkey"
      FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 6. resources ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "resources" (
  "id"                       TEXT NOT NULL,
  "hotel_id"                 TEXT NOT NULL,
  "resource_category_id"     TEXT NOT NULL,
  "building_id"              TEXT,
  "floor_id"                 TEXT,
  "name"                     TEXT NOT NULL,
  "code"                     TEXT NOT NULL,
  "description"              TEXT,
  "booking_unit"             "BookingUnit" NOT NULL DEFAULT 'NIGHT',
  "is_bookable"              BOOLEAN NOT NULL DEFAULT true,
  "marketplace_visibility"   "ResourceMarketplaceVisibility" NOT NULL DEFAULT 'PRIVATE',
  "lifecycle_status"         "ResourceLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "operational_status"       "ResourceOperationalStatus" NOT NULL DEFAULT 'READY',
  "capacity"                 INTEGER,
  "minimum_capacity"         INTEGER,
  "minimum_duration_minutes" INTEGER,
  "maximum_duration_minutes" INTEGER,
  "buffer_before_minutes"    INTEGER NOT NULL DEFAULT 0,
  "buffer_after_minutes"     INTEGER NOT NULL DEFAULT 0,
  "attributes"               JSONB,
  "internal_notes"           TEXT,
  "price_per_night"          DECIMAL(12,2),
  "archived_at"              TIMESTAMPTZ,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resources_hotel_id_code_key"
  ON "resources"("hotel_id","code");
CREATE INDEX IF NOT EXISTS "resources_hotel_id_resource_category_id_idx"
  ON "resources"("hotel_id","resource_category_id");
CREATE INDEX IF NOT EXISTS "resources_hotel_id_lifecycle_status_is_bookable_idx"
  ON "resources"("hotel_id","lifecycle_status","is_bookable");

DO $$ BEGIN
  ALTER TABLE "resources"
    ADD CONSTRAINT "resources_hotel_id_fkey"
      FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "resources"
    ADD CONSTRAINT "resources_resource_category_id_fkey"
      FOREIGN KEY ("resource_category_id") REFERENCES "resource_categories"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "resources"
    ADD CONSTRAINT "resources_building_id_fkey"
      FOREIGN KEY ("building_id") REFERENCES "buildings"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "resources"
    ADD CONSTRAINT "resources_floor_id_fkey"
      FOREIGN KEY ("floor_id") REFERENCES "floors"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 7. resource_images ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "resource_images" (
  "id"          TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "caption"     TEXT,
  "is_primary"  BOOLEAN NOT NULL DEFAULT false,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resource_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "resource_images_resource_id_idx"
  ON "resource_images"("resource_id");

DO $$ BEGIN
  ALTER TABLE "resource_images"
    ADD CONSTRAINT "resource_images_resource_id_fkey"
      FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 8. availability_blocks ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "availability_blocks" (
  "id"                 TEXT NOT NULL,
  "property_id"        TEXT NOT NULL,
  "resource_id"        TEXT NOT NULL,
  "start_at"           TIMESTAMPTZ NOT NULL,
  "end_at"             TIMESTAMPTZ NOT NULL,
  "reason"             TEXT NOT NULL DEFAULT 'OTHER',
  "notes"              TEXT,
  "created_by_user_id" TEXT,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "availability_blocks_resource_id_start_at_end_at_idx"
  ON "availability_blocks"("resource_id","start_at","end_at");

DO $$ BEGIN
  ALTER TABLE "availability_blocks"
    ADD CONSTRAINT "availability_blocks_resource_id_fkey"
      FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 9. Booking: make roomTypeId nullable, add resourceId ────────────────────

ALTER TABLE "Booking"
  ALTER COLUMN "roomTypeId" DROP NOT NULL;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "resourceId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_resourceId_fkey"
      FOREIGN KEY ("resourceId") REFERENCES "resources"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Booking_resourceId_idx" ON "Booking"("resourceId");

-- ─── Walk-in payment method ───────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "WalkInPaymentMethod" AS ENUM ('CASH', 'POS', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "walkInPaymentMethod" "WalkInPaymentMethod";

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- All tables and columns created. Restart the API server after running this.
