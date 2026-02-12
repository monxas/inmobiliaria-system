-- Add Google OAuth2 fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expiry BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_scopes TEXT;

-- Make password_hash nullable for Google-only users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
