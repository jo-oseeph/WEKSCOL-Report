-- Preserve every account that already exists when this migration is applied.
-- New registrations are pending until an administrator approves them.
UPDATE users
SET role = COALESCE(role, 'user'),
    status = 'approved';

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'user',
  ALTER COLUMN status SET DEFAULT 'pending';