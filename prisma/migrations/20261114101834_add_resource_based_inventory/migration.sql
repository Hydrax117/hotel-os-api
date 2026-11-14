-- Migration: add_resource_based_inventory
-- Adds ResourceType, ResourceCategory, Building, Floor, Resource, ResourceImage
-- alongside the existing Hotel/RoomType/Room model (non-breaking).

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "BookingUnit" AS ENUM ('NIGHT', 'HOUR', 'DAY', 'SESSION', 'CUSTOM');
CREATE TYPE "ResourceLifecycleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "ResourceOperationalStatus" AS ENUM ('READY', 'DIRTY', 'OCCUPIED', 'INSPECTION', 'MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "ResourceMarketplaceVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- ─── ResourceType (system-seeded) ────────────────────────────────────────────

CREATE TABLE "resource_types" (
  "id"               TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "description"      TEXT,
  "default_bookable" BOOLEAN NOT NULL DEFAULT true,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "resource_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resource_types_code_key" ON "resource_types"("code");

-- ─── ResourceCategory ─────────────────────────────────────────────────────────

CREATE TABLE "resource_categories" (
  "id"                              TEXT NOT NULL,
  "hotel_id"                        TEXT NOT NULL,
  "resource_type_id"                TEXT NOT NULL,
  "name"                            TEXT NOT NULL,
  "code"                            TEXT NOT NULL,
  "description"                     TEXT,
  "default_booking_unit"            "BookingUnit" NOT NULL DEFAULT 'NIGHT',
  "default_capacity"                INTEGER,
  "default_minimum_duration_minutes" INTEGER,
  "default_maximum_duration_minutes" INTEGER,
  "is_active"                       BOOLEAN NOT NULL DEFAULT true,
  "created_at"                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "resource_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resource_categories_hotel_id_code_key" ON "resource_categories"("hotel_id", "code");
CREATE INDEX "resource_categories_hotel_id_resource_type_id_idx" ON "resource_categories"("hotel_id", "resource_type_id");

ALTER TABLE "resource_categories"
  ADD CONSTRAINT "resource_categories_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "resource_categories_resource_type_id_fkey"
    FOREIGN KEY ("resource_type_id") REFERENCES "resource_types"("id");

-- ─── Building ─────────────────────────────────────────────────────────────────

CREATE TABLE "buildings" (
  "id"         TEXT NOT NULL,
  "hotel_id"   TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "buildings_hotel_id_code_key" ON "buildings"("hotel_id", "code");

ALTER TABLE "buildings"
  ADD CONSTRAINT "buildings_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE;

-- ─── Floor ────────────────────────────────────────────────────────────────────

CREATE TABLE "floors" (
  "id"           TEXT NOT NULL,
  "hotel_id"     TEXT NOT NULL,
  "building_id"  TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "level_number" INTEGER NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "floors_hotel_id_building_id_idx" ON "floors"("hotel_id", "building_id");

ALTER TABLE "floors"
  ADD CONSTRAINT "floors_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "floors_building_id_fkey"
    FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE;

-- ─── Resource ─────────────────────────────────────────────────────────────────

CREATE TABLE "resources" (
  "id"                          TEXT NOT NULL,
  "hotel_id"                    TEXT NOT NULL,
  "resource_category_id"        TEXT NOT NULL,
  "building_id"                 TEXT,
  "floor_id"                    TEXT,
  "name"                        TEXT NOT NULL,
  "code"                        TEXT NOT NULL,
  "description"                 TEXT,
  "booking_unit"                "BookingUnit" NOT NULL DEFAULT 'NIGHT',
  "is_bookable"                 BOOLEAN NOT NULL DEFAULT true,
  "marketplace_visibility"      "ResourceMarketplaceVisibility" NOT NULL DEFAULT 'PRIVATE',
  "lifecycle_status"            "ResourceLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "operational_status"          "ResourceOperationalStatus" NOT NULL DEFAULT 'READY',
  "capacity"                    INTEGER,
  "minimum_capacity"            INTEGER,
  "minimum_duration_minutes"    INTEGER,
  "maximum_duration_minutes"    INTEGER,
  "buffer_before_minutes"       INTEGER NOT NULL DEFAULT 0,
  "buffer_after_minutes"        INTEGER NOT NULL DEFAULT 0,
  "attributes"                  JSONB,
  "internal_notes"              TEXT,
  "archived_at"                 TIMESTAMPTZ,
  "created_at"                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resources_hotel_id_code_key" ON "resources"("hotel_id", "code");
CREATE INDEX "resources_hotel_id_resource_category_id_idx" ON "resources"("hotel_id", "resource_category_id");
CREATE INDEX "resources_hotel_id_lifecycle_status_is_bookable_idx" ON "resources"("hotel_id", "lifecycle_status", "is_bookable");

ALTER TABLE "resources"
  ADD CONSTRAINT "resources_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "Hotel"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "resources_resource_category_id_fkey"
    FOREIGN KEY ("resource_category_id") REFERENCES "resource_categories"("id"),
  ADD CONSTRAINT "resources_building_id_fkey"
    FOREIGN KEY ("building_id") REFERENCES "buildings"("id"),
  ADD CONSTRAINT "resources_floor_id_fkey"
    FOREIGN KEY ("floor_id") REFERENCES "floors"("id");

-- ─── ResourceImage ────────────────────────────────────────────────────────────

CREATE TABLE "resource_images" (
  "id"          TEXT NOT NULL,
  "resource_id" TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "caption"     TEXT,
  "is_primary"  BOOLEAN NOT NULL DEFAULT false,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "resource_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resource_images_resource_id_idx" ON "resource_images"("resource_id");

ALTER TABLE "resource_images"
  ADD CONSTRAINT "resource_images_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;

-- ─── Seed: ResourceType values ────────────────────────────────────────────────

INSERT INTO "resource_types" ("id", "code", "name", "description", "default_bookable") VALUES
  ('rtype_accommodation',      'ACCOMMODATION',       'Accommodation',       'Rooms, suites, apartments and other sleeping accommodation', true),
  ('rtype_hospitality_space',  'HOSPITALITY_SPACE',   'Hospitality Space',   'VIP lounges, private dining rooms and other hospitality spaces', true),
  ('rtype_event_space',        'EVENT_SPACE',          'Event Space',         'Conference rooms, event halls and other bookable event spaces', true),
  ('rtype_scheduled_facility', 'SCHEDULED_FACILITY',  'Scheduled Facility',  'Spa treatment rooms, pool sessions and other scheduled slots', true),
  ('rtype_general_facility',   'GENERAL_FACILITY',    'General Facility',    'Non-bookable facilities such as gym, shared pool, lobby', false);

-- ─── AvailabilityBlock (was missing from initial migration) ──────────────────

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
  ON "availability_blocks"("resource_id", "start_at", "end_at");

ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_blocks_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;
