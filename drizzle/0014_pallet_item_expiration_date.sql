ALTER TABLE pallet_items ADD COLUMN IF NOT EXISTS expiration_date date;--> statement-breakpoint
UPDATE pallet_items
SET expiration_date = expiration_date_note::date
WHERE expiration_date_note ~ '^\d{4}-\d{2}-\d{2}$';--> statement-breakpoint
ALTER TABLE pallet_items DROP COLUMN IF EXISTS expiration_date_note;
