-- =============================================================================
-- 011_rollback.sql - Rollback for 011_advanced_indexes.sql
-- =============================================================================

-- Composite indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_properties_search;
DROP INDEX CONCURRENTLY IF EXISTS idx_properties_agent_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_properties_price_range;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_login;
DROP INDEX CONCURRENTLY IF EXISTS idx_clients_agent_recent;
DROP INDEX CONCURRENTLY IF EXISTS idx_documents_property_category;
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_user_unread_ordered;
DROP INDEX CONCURRENTLY IF EXISTS idx_sessions_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_viewings_upcoming;

-- GIN indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_properties_text_search;

-- Partial indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_properties_available;
DROP INDEX CONCURRENTLY IF EXISTS idx_notifications_recent;
