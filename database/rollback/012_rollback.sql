-- =============================================================================
-- 012_rollback.sql - Rollback for 012_performance_tuning.sql
-- =============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS trg_users_updated ON users;
DROP TRIGGER IF EXISTS trg_properties_updated ON properties;
DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
DROP TRIGGER IF EXISTS trg_documents_updated ON documents;

-- Drop functions
DROP FUNCTION IF EXISTS soft_delete();
DROP FUNCTION IF EXISTS update_timestamp();

-- Drop unique indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email_lower;
DROP INDEX CONCURRENTLY IF EXISTS idx_clients_email_agent;

-- Remove constraints (with error handling)
DO $$
BEGIN
  ALTER TABLE properties DROP CONSTRAINT IF EXISTS check_price_for_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE property_viewings DROP CONSTRAINT IF EXISTS check_valid_viewing;
EXCEPTION
  WHEN undefined_object THEN NULL;
END
$$;

-- Reset fillfactor to default (100)
ALTER TABLE properties RESET (fillfactor);
ALTER TABLE clients RESET (fillfactor);
ALTER TABLE notifications RESET (fillfactor);
ALTER TABLE user_sessions RESET (fillfactor);

-- Reset autovacuum settings
ALTER TABLE notifications RESET (
  autovacuum_vacuum_threshold,
  autovacuum_analyze_threshold,
  autovacuum_vacuum_scale_factor
);

ALTER TABLE user_sessions RESET (
  autovacuum_vacuum_threshold,
  autovacuum_analyze_threshold,
  autovacuum_vacuum_scale_factor
);

ALTER TABLE file_access_logs RESET (
  autovacuum_vacuum_threshold,
  autovacuum_vacuum_scale_factor
);
