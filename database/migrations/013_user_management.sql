-- Migration 013: User Management Enhancement
-- User profiles, groups, permissions, activity tracking, 2FA

-- User Profiles (extended profile information)
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    job_title VARCHAR(100),
    department VARCHAR(100),
    location VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'es',
    avatar_path VARCHAR(500),
    cover_image_path VARCHAR(500),
    social_links JSONB DEFAULT '{}',
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false, "types": ["all"]}',
    profile_completeness INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT false,
    terms_accepted_at TIMESTAMPTZ,
    privacy_accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Groups/Teams
CREATE TABLE IF NOT EXISTS user_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7),
    icon_name VARCHAR(50),
    parent_id INTEGER REFERENCES user_groups(id),
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Group Memberships
CREATE TABLE IF NOT EXISTS user_group_memberships (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, group_id)
);

-- User Activities (activity history)
CREATE TABLE IF NOT EXISTS user_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Login History
CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    success BOOLEAN NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    geo_location JSONB,
    failure_reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions definitions
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles (enhanced role system)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER DEFAULT 0,
    color VARCHAR(7),
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES users(id),
    UNIQUE(role_id, permission_id)
);

-- User-specific permission overrides
CREATE TABLE IF NOT EXISTS user_permission_overrides (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL,
    reason TEXT,
    expires_at TIMESTAMPTZ,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, permission_id)
);

-- User role assignments (multiple roles per user)
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, role_id)
);

-- Two-Factor Authentication
CREATE TABLE IF NOT EXISTS two_factor_secrets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    secret VARCHAR(255) NOT NULL,
    backup_codes TEXT,
    is_enabled BOOLEAN DEFAULT false,
    last_used_at TIMESTAMPTZ,
    enabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account Status tracking
CREATE TABLE IF NOT EXISTS account_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    activated_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspended_reason TEXT,
    suspended_by INTEGER REFERENCES users(id),
    deactivated_at TIMESTAMPTZ,
    deactivated_reason TEXT,
    last_status_change TIMESTAMPTZ DEFAULT NOW(),
    password_last_changed TIMESTAMPTZ,
    password_expires_at TIMESTAMPTZ,
    must_change_password BOOLEAN DEFAULT false,
    lockout_count INTEGER DEFAULT 0,
    last_lockout_at TIMESTAMPTZ
);

-- Impersonation logs
CREATE TABLE IF NOT EXISTS impersonation_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    ip_address VARCHAR(45),
    actions_performed INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_groups_slug ON user_groups(slug);
CREATE INDEX IF NOT EXISTS idx_user_group_memberships_user ON user_group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_group_memberships_group ON user_group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_account_status_status ON account_status(status);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin ON impersonation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target ON impersonation_logs(target_user_id);

-- Seed default roles
INSERT INTO roles (name, display_name, description, level, color, is_system) VALUES
    ('admin', 'Administrador', 'Acceso completo al sistema', 100, '#ef4444', true),
    ('agent', 'Agente', 'Agente inmobiliario con acceso a propiedades y clientes', 50, '#3b82f6', true),
    ('client', 'Cliente', 'Cliente con acceso limitado', 10, '#22c55e', true)
ON CONFLICT (name) DO NOTHING;

-- Seed default permissions
INSERT INTO permissions (name, description, resource, action, is_system) VALUES
    -- Properties
    ('properties.create', 'Crear propiedades', 'properties', 'create', true),
    ('properties.read', 'Ver propiedades', 'properties', 'read', true),
    ('properties.update', 'Actualizar propiedades', 'properties', 'update', true),
    ('properties.delete', 'Eliminar propiedades', 'properties', 'delete', true),
    ('properties.manage', 'Gestión completa de propiedades', 'properties', 'manage', true),
    -- Clients
    ('clients.create', 'Crear clientes', 'clients', 'create', true),
    ('clients.read', 'Ver clientes', 'clients', 'read', true),
    ('clients.update', 'Actualizar clientes', 'clients', 'update', true),
    ('clients.delete', 'Eliminar clientes', 'clients', 'delete', true),
    ('clients.manage', 'Gestión completa de clientes', 'clients', 'manage', true),
    -- Users
    ('users.create', 'Crear usuarios', 'users', 'create', true),
    ('users.read', 'Ver usuarios', 'users', 'read', true),
    ('users.update', 'Actualizar usuarios', 'users', 'update', true),
    ('users.delete', 'Eliminar usuarios', 'users', 'delete', true),
    ('users.manage', 'Gestión completa de usuarios', 'users', 'manage', true),
    ('users.impersonate', 'Impersonar usuarios', 'users', 'impersonate', true),
    -- Documents
    ('documents.create', 'Crear documentos', 'documents', 'create', true),
    ('documents.read', 'Ver documentos', 'documents', 'read', true),
    ('documents.update', 'Actualizar documentos', 'documents', 'update', true),
    ('documents.delete', 'Eliminar documentos', 'documents', 'delete', true),
    ('documents.manage', 'Gestión completa de documentos', 'documents', 'manage', true),
    -- System
    ('system.settings', 'Configuración del sistema', 'system', 'settings', true),
    ('system.audit', 'Ver auditoría del sistema', 'system', 'audit', true),
    ('system.reports', 'Generar reportes', 'system', 'reports', true)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Agent gets properties, clients, documents (not manage)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'agent' 
AND (
    (p.resource = 'properties' AND p.action IN ('create', 'read', 'update'))
    OR (p.resource = 'clients' AND p.action IN ('create', 'read', 'update'))
    OR (p.resource = 'documents' AND p.action IN ('create', 'read', 'update'))
)
ON CONFLICT DO NOTHING;

-- Client gets read-only for properties
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'client' 
AND p.resource = 'properties' AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- Create profiles for existing users
INSERT INTO user_profiles (user_id, profile_completeness)
SELECT id, 20 FROM users WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE user_profiles.user_id = users.id
);

-- Create account status for existing users
INSERT INTO account_status (user_id, status, activated_at)
SELECT id, 'active', created_at FROM users WHERE NOT EXISTS (
    SELECT 1 FROM account_status WHERE account_status.user_id = users.id
);

-- Assign roles to existing users based on their role enum
INSERT INTO user_roles (user_id, role_id, is_primary)
SELECT u.id, r.id, true FROM users u
JOIN roles r ON r.name = u.role::text
WHERE NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = u.id AND user_roles.role_id = r.id
);

-- ROLLBACK
-- DROP TABLE IF EXISTS impersonation_logs CASCADE;
-- DROP TABLE IF EXISTS account_status CASCADE;
-- DROP TABLE IF EXISTS two_factor_secrets CASCADE;
-- DROP TABLE IF EXISTS user_roles CASCADE;
-- DROP TABLE IF EXISTS user_permission_overrides CASCADE;
-- DROP TABLE IF EXISTS role_permissions CASCADE;
-- DROP TABLE IF EXISTS roles CASCADE;
-- DROP TABLE IF EXISTS permissions CASCADE;
-- DROP TABLE IF EXISTS login_history CASCADE;
-- DROP TABLE IF EXISTS user_activities CASCADE;
-- DROP TABLE IF EXISTS user_group_memberships CASCADE;
-- DROP TABLE IF EXISTS user_groups CASCADE;
-- DROP TABLE IF EXISTS user_profiles CASCADE;
