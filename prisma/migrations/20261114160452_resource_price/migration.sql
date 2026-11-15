-- Migration: resource_price
-- Adds price_per_night to resources so bookings have a real price

ALTER TABLE "resources"
  ADD COLUMN IF NOT EXISTS "price_per_night" DECIMAL(12, 2);
