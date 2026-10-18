-- Credit limit (NULL = no limit) and payment terms in days for overdue-AR checks on booking.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_limit numeric(12, 2),
  ADD COLUMN IF NOT EXISTS credit_terms_days integer NOT NULL DEFAULT 30;
