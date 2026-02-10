-- =============================================================================
-- 011_advanced_indexes.sql
-- Level 1 Foundation - Database Performance Optimization
-- =============================================================================

-- Composite indexes for common query patterns
-- =============================================================================

-- Properties: Search with filters (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_search 
ON properties(status, property_type, city, price) 
WHERE deleted_at IS NULL;

-- Properties: Dashboard queries (agent's properties)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_agent_status 
ON properties(agent_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

-- Properties: Price range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_price_range 
ON properties(price, bedrooms, surface_area) 
WHERE deleted_at IS NULL AND status = 'available';

-- Users: Login lookup (email + password verification)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_login 
ON users(email, password_hash) 
WHERE deleted_at IS NULL;

-- Clients: Agent's client list with date sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_agent_recent 
ON clients(agent_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Documents: Property documents with category
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_property_category 
ON documents(property_id, category, created_at DESC) 
WHERE deleted_at IS NULL;

-- Notifications: User's unread notifications (ordered)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread_ordered 
ON notifications(user_id, created_at DESC) 
WHERE read_at IS NULL;

-- Sessions: Token lookup with expiry check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active 
ON user_sessions(token_hash, user_id) 
WHERE expires_at > CURRENT_TIMESTAMP;

-- Property viewings: Upcoming viewings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_viewings_upcoming 
ON property_viewings(agent_id, scheduled_at) 
WHERE scheduled_at > CURRENT_TIMESTAMP AND status = 'scheduled';

-- =============================================================================
-- GIN indexes for text search (future full-text search support)
-- =============================================================================

-- Property title/description search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_text_search 
ON properties 
USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(description, '')));

-- =============================================================================
-- Partial indexes for hot data
-- =============================================================================

-- Available properties only (most queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_available 
ON properties(city, property_type, price, created_at DESC) 
WHERE status = 'available' AND deleted_at IS NULL;

-- Recent notifications (last 30 days)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_recent 
ON notifications(user_id, type, created_at) 
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';

-- =============================================================================
-- Statistics hints
-- =============================================================================

-- Update statistics for query planner
ANALYZE users;
ANALYZE properties;
ANALYZE clients;
ANALYZE documents;
ANALYZE notifications;
ANALYZE property_viewings;
