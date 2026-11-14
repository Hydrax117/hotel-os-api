-- Migration: booking_resource_id
-- Makes roomTypeId nullable (keeps historical bookings intact)
-- Adds resourceId FK to Resource for new bookings

ALTER TABLE "Booking"
  ALTER COLUMN "roomTypeId" DROP NOT NULL;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "resourceId" TEXT;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "resources"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Booking_resourceId_idx" ON "Booking"("resourceId");
