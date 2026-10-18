-- Driver login accounts and per-day delivery schedule.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'driver';

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS scheduled_date text;
