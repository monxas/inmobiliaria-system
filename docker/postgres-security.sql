-- =============================================================================
-- PostgreSQL Security Hardening
-- Level 1 Foundation - Database Security
-- =============================================================================

-- Revoke public schema access from public role
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Create application role with limited permissions
DO $$
BEGIN
  -- Only grant what's needed for the application
  GRANT USAGE ON SCHEMA public TO app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;
  
  -- Set default privileges for future tables
  ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO app;
END
$$;

-- Disable unnecessary extensions loading
-- (Already limited in Alpine image, but explicit)

-- Set secure session defaults
ALTER DATABASE inmobiliaria SET statement_timeout = '30s';
ALTER DATABASE inmobiliaria SET lock_timeout = '10s';
ALTER DATABASE inmobiliaria SET idle_in_transaction_session_timeout = '60s';

-- Log configuration for security auditing
ALTER DATABASE inmobiliaria SET log_connections = on;
ALTER DATABASE inmobiliaria SET log_disconnections = on;

-- Performance: Ensure autovacuum is properly configured
ALTER DATABASE inmobiliaria SET autovacuum_vacuum_cost_limit = 200;
ALTER DATABASE inmobiliaria SET autovacuum_naptime = '30s';
