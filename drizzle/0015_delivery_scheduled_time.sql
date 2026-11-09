ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS scheduled_time text;
