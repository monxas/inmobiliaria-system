-- 010_fix_viewing_status.sql
-- Convert property_viewings.status from VARCHAR to ENUM

CREATE TYPE viewing_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

ALTER TABLE property_viewings
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'scheduled',
  ALTER COLUMN status TYPE viewing_status USING status::viewing_status;
