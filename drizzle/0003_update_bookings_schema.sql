-- Drop the foreign key constraint on driver_id first
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_driver_id_drivers_id_fk";

-- Remove driver_id column
ALTER TABLE "bookings" DROP COLUMN "driver_id";

-- Remove updated_at column
ALTER TABLE "bookings" DROP COLUMN "updated_at";

-- Add created_by column to bookings table
ALTER TABLE "bookings" ADD COLUMN "created_by" text NOT NULL;

-- Add foreign key constraint for created_by
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
