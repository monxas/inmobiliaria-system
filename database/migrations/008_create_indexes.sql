-- 008_create_indexes.sql
-- Optimized indexes for frequent queries

-- Users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;

-- Properties
CREATE INDEX idx_properties_status ON properties(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_type ON properties(property_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_price ON properties(price) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_city ON properties(city) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_agent ON properties(agent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_owner ON properties(owner_id) WHERE deleted_at IS NULL;

-- Property images
CREATE INDEX idx_property_images_property ON property_images(property_id);
CREATE INDEX idx_property_images_primary ON property_images(property_id) WHERE is_primary = TRUE;
CREATE INDEX idx_property_images_order ON property_images(property_id, order_index);

-- Clients
CREATE INDEX idx_clients_email ON clients(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_agent ON clients(agent_id) WHERE deleted_at IS NULL;

-- Client-Properties
CREATE INDEX idx_client_properties_client ON client_properties(client_id);
CREATE INDEX idx_client_properties_property ON client_properties(property_id);
CREATE INDEX idx_client_properties_relationship ON client_properties(relationship_type);

-- Documents
CREATE INDEX idx_documents_property ON documents(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_client ON documents(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_category ON documents(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_token ON documents(access_token) WHERE access_token IS NOT NULL;
CREATE INDEX idx_documents_expires ON documents(expires_at) WHERE expires_at IS NOT NULL;

-- Sessions & Auth
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX idx_password_resets_expires ON password_resets(expires_at);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_type ON notifications(type);
