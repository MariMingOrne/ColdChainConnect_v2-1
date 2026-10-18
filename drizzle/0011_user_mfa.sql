-- TOTP MFA: secret (pending until enabled) and enabled flag per user.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_secret text,
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
