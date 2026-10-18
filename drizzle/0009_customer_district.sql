-- Add district to customers; orders are dispatched to the truck whose district matches.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS district text;
