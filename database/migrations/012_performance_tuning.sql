-- =============================================================================
-- 012_performance_tuning.sql
-- Level 1 Foundation - Database Optimization
-- =============================================================================

-- =============================================================================
-- Additional constraints for data integrity
-- =============================================================================

-- Ensure email uniqueness case-insensitively
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower 
ON users(lower(email)) 
WHERE deleted_at IS NULL;

-- Ensure client email uniqueness per agent (if provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_agent 
ON clients(lower(email), agent_id) 
WHERE email IS NOT NULL AND deleted_at IS NULL;

-- Ensure property has valid price for status
ALTER TABLE properties 
ADD CONSTRAINT check_price_for_status 
CHECK (
  (status IN ('sold', 'rented') AND price > 0) OR
  (status NOT IN ('sold', 'rented'))
);

-- Ensure viewing is in the future (at creation)
-- Note: existing constraint may need to be dropped first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_valid_viewing'
  ) THEN
    ALTER TABLE property_viewings
    ADD CONSTRAINT check_valid_viewing
    CHECK (scheduled_at >= created_at);
  END IF;
END
$$;

-- =============================================================================
-- Table-specific optimizations
-- =============================================================================

-- Cluster properties by agent_id for better locality
-- CLUSTER properties USING idx_properties_agent;
-- Note: CLUSTER is intensive, run during maintenance window

-- Set fillfactor for frequently updated tables
ALTER TABLE properties SET (fillfactor = 90);
ALTER TABLE clients SET (fillfactor = 90);
ALTER TABLE notifications SET (fillfactor = 85);
ALTER TABLE user_sessions SET (fillfactor = 80);

-- =============================================================================
-- Autovacuum tuning for specific tables
-- =============================================================================

-- Notifications: high write volume
ALTER TABLE notifications SET (
  autovacuum_vacuum_threshold = 50,
  autovacuum_analyze_threshold = 50,
  autovacuum_vacuum_scale_factor = 0.1
);

-- Sessions: very high write/delete volume
ALTER TABLE user_sessions SET (
  autovacuum_vacuum_threshold = 25,
  autovacuum_analyze_threshold = 25,
  autovacuum_vacuum_scale_factor = 0.05
);

-- File access logs: append-only, lots of writes
ALTER TABLE file_access_logs SET (
  autovacuum_vacuum_threshold = 1000,
  autovacuum_vacuum_scale_factor = 0.2
);

-- =============================================================================
-- Helper functions for common operations
-- =============================================================================

-- Function to soft delete with timestamp
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  NEW.deleted_at = CURRENT_TIMESTAMP;
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamp on modification
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Triggers for automatic timestamp updates
-- =============================================================================

-- Users updated_at trigger
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION update_timestamp();

-- Properties updated_at trigger
DROP TRIGGER IF EXISTS trg_properties_updated ON properties;
CREATE TRIGGER trg_properties_updated
BEFORE UPDATE ON properties
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION update_timestamp();

-- Clients updated_at trigger
DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated
BEFORE UPDATE ON clients
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION update_timestamp();

-- Documents updated_at trigger
DROP TRIGGER IF EXISTS trg_documents_updated ON documents;
CREATE TRIGGER trg_documents_updated
BEFORE UPDATE ON documents
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION update_timestamp();
