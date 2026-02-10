# 🗄️ DATABASE SCHEMA
**PostgreSQL 16 - Schema completo con migraciones**

---

## 🎯 PRINCIPIOS

**Database Design:**
- **Soft deletes** — `deleted_at` timestamp para auditoría
- **Audit trails** — `created_at`, `updated_at` en todas las tablas
- **Índices optimizados** — performance queries más frecuentes
- **Constraints** — integridad referencial + business rules
- **Extensibilidad** — preparado para multi-tenant si es necesario

---

## 📋 SCHEMA COMPLETO

### **🔐 Authentication & Users**
```sql
-- User roles enum
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'client');

-- Main users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- User sessions for JWT tracking
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL, -- Hash of JWT token
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **🏠 Properties Core**
```sql
-- Property types and status
CREATE TYPE property_type AS ENUM ('house', 'apartment', 'office', 'warehouse', 'land', 'commercial');
CREATE TYPE property_status AS ENUM ('available', 'reserved', 'sold', 'rented', 'off_market');

-- Main properties table
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'España',
  
  -- Property details
  property_type property_type NOT NULL,
  status property_status NOT NULL DEFAULT 'available',
  price DECIMAL(12, 2) NOT NULL,
  surface_area INTEGER, -- m2
  bedrooms INTEGER,
  bathrooms INTEGER,
  garage BOOLEAN DEFAULT FALSE,
  garden BOOLEAN DEFAULT FALSE,
  
  -- Relations
  owner_id INTEGER REFERENCES users(id),
  agent_id INTEGER REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 🆕 CRÍTICO: Property images (detectado por agente)
CREATE TABLE property_images (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- Image metadata
  order_index INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  alt_text TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Property features (flexible key-value)
CREATE TABLE property_features (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL, -- e.g., 'elevator', 'parking', 'pool'
  feature_value TEXT, -- e.g., 'yes', 'no', '2 spaces'
  
  UNIQUE(property_id, feature_key)
);
```

### **👥 Clients & Relationships** 
```sql
-- Clients table (separate from users for flexibility)
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  
  -- Relations
  agent_id INTEGER REFERENCES users(id), -- Assigned agent
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 🆕 Many-to-many: Client-Property relationships (detectado por agente)
CREATE TYPE client_property_relationship AS ENUM ('interested', 'viewing', 'offer_made', 'contracted');

CREATE TABLE client_properties (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  relationship_type client_property_relationship NOT NULL DEFAULT 'interested',
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Property viewings/appointments  
CREATE TABLE property_viewings (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES users(id),
  
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **📄 Documents & Files**
```sql
-- File categories
CREATE TYPE file_category AS ENUM ('property_docs', 'property_images', 'client_docs', 'contracts', 'other');

-- Main documents table
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  
  -- File details
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  category file_category NOT NULL DEFAULT 'other',
  
  -- Relations (polymorphic-like)
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Access control
  access_token VARCHAR(255) UNIQUE, -- For secure URLs
  expires_at TIMESTAMP WITH TIME ZONE,
  download_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Uploaded by
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- File access logs (auditoría)
CREATE TABLE file_access_logs (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  accessed_by INTEGER REFERENCES users(id), -- NULL if anonymous access
  ip_address INET NOT NULL,
  user_agent TEXT,
  access_token_used VARCHAR(255),
  
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **📧 Notifications & Communication**
```sql
-- Notification types
CREATE TYPE notification_type AS ENUM ('document_uploaded', 'link_expiring', 'viewing_scheduled', 'property_updated', 'system');

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Optional relations
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  
  -- Status
  read_at TIMESTAMP WITH TIME ZONE,
  sent_via_email BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email templates for transactional emails
CREATE TABLE email_templates (
  id SERIAL PRIMARY KEY,
  template_key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'document_link', 'welcome'
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL, -- HTML template
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔍 ÍNDICES OPTIMIZADOS

```sql
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

-- Client-Properties relationships
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
```

---

## 🔐 CONSTRAINTS & BUSINESS RULES

```sql
-- Property images: only one primary per property
CREATE UNIQUE INDEX idx_property_images_unique_primary 
ON property_images(property_id) 
WHERE is_primary = TRUE;

-- Documents: access token required if expires_at is set
ALTER TABLE documents ADD CONSTRAINT check_token_if_expires 
CHECK (expires_at IS NULL OR access_token IS NOT NULL);

-- Properties: price must be positive
ALTER TABLE properties ADD CONSTRAINT check_positive_price 
CHECK (price > 0);

-- Property viewings: must be in the future when created
ALTER TABLE property_viewings ADD CONSTRAINT check_future_viewing 
CHECK (scheduled_at > created_at);

-- Users: email format validation (basic)
ALTER TABLE users ADD CONSTRAINT check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

---

## 📊 SEEDS & TEST DATA

```sql
-- Admin user
INSERT INTO users (email, password_hash, role, full_name) VALUES 
('admin@inmobiliaria.local', '$2b$10$hash...', 'admin', 'Administrador');

-- Sample property types for seeding
INSERT INTO properties (title, description, address, city, property_type, status, price, surface_area, bedrooms, bathrooms) VALUES 
('Piso céntrico en Oviedo', 'Amplio piso de 3 habitaciones...', 'Calle Uría 15', 'Oviedo', 'apartment', 'available', 250000.00, 95, 3, 2),
('Casa unifamiliar Gijón', 'Casa con jardín y garaje...', 'Avenida de la Costa 45', 'Gijón', 'house', 'available', 380000.00, 150, 4, 3);

-- Email templates básicos
INSERT INTO email_templates (template_key, subject_template, body_template) VALUES 
('document_link', 'Documento disponible: {{document_name}}', '<p>Su documento está disponible en: <a href="{{download_url}}">{{document_name}}</a></p><p>El enlace expira el {{expires_at}}.</p>'),
('welcome', 'Bienvenido a {{company_name}}', '<p>Bienvenido {{user_name}},</p><p>Su cuenta ha sido creada exitosamente.</p>');
```

---

## 🔄 MIGRATIONS STRATEGY

### **Migration Files Structure**
```
database/migrations/
├── 001_create_users.sql
├── 002_create_properties.sql  
├── 003_create_property_images.sql     # 🆕 CRÍTICO
├── 004_create_clients.sql
├── 005_create_client_properties.sql   # 🆕 Many-to-many
├── 006_create_documents.sql
├── 007_create_notifications.sql
├── 008_create_indexes.sql
└── 009_seed_basic_data.sql
```

### **Migration Runner (Drizzle)**
```typescript
// database/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

async function runMigrations() {
  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './database/migrations' })
  console.log('Migrations completed!')
  await client.end()
}

runMigrations()
```

---

## 🧪 DATA VALIDATION

### **Drizzle Schema Definitions**
```typescript
// src/database/schema/users.ts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('client'),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  avatarUrl: text('avatar_url'),
  
  createdAt: timestamp('created_at').withTimezone().defaultNow(),
  updatedAt: timestamp('updated_at').withTimezone().defaultNow(),
  deletedAt: timestamp('deleted_at').withTimezone(),
})

export type User = InferSelectModel<typeof users>
export type CreateUser = InferInsertModel<typeof users>
export type UpdateUser = Partial<CreateUser>
```

### **Zod Validation Schemas**
```typescript
// src/validation/property.schemas.ts
export const createPropertySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1).max(100),
  postalCode: z.string().optional(),
  propertyType: z.enum(['house', 'apartment', 'office', 'warehouse', 'land', 'commercial']),
  status: z.enum(['available', 'reserved', 'sold', 'rented', 'off_market']).default('available'),
  price: z.number().positive(),
  surfaceArea: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  garage: z.boolean().default(false),
  garden: z.boolean().default(false),
  ownerId: z.number().int().optional(),
  agentId: z.number().int().optional(),
})
```

---

## 🎯 QUERIES FRECUENTES OPTIMIZADAS

```sql
-- Buscar propiedades con filtros
SELECT p.*, 
       pi.file_path AS primary_image,
       u.full_name AS agent_name
FROM properties p
LEFT JOIN property_images pi ON p.id = pi.property_id AND pi.is_primary = TRUE
LEFT JOIN users u ON p.agent_id = u.id
WHERE p.deleted_at IS NULL
  AND p.status = 'available'
  AND p.property_type = $1
  AND p.price BETWEEN $2 AND $3
  AND p.city ILIKE $4
ORDER BY p.created_at DESC
LIMIT $5 OFFSET $6;

-- Cliente con sus propiedades de interés
SELECT c.*, 
       array_agg(
         json_build_object(
           'property_id', p.id,
           'title', p.title,
           'relationship', cp.relationship_type,
           'since', cp.created_at
         )
       ) AS properties
FROM clients c
LEFT JOIN client_properties cp ON c.id = cp.client_id
LEFT JOIN properties p ON cp.property_id = p.id
WHERE c.deleted_at IS NULL
GROUP BY c.id;

-- Documentos próximos a expirar
SELECT d.*, p.title AS property_title
FROM documents d
LEFT JOIN properties p ON d.property_id = p.id
WHERE d.expires_at IS NOT NULL
  AND d.expires_at > CURRENT_TIMESTAMP
  AND d.expires_at < CURRENT_TIMESTAMP + INTERVAL '24 hours'
  AND d.deleted_at IS NULL;
```

---

## 📈 PERFORMANCE CONSIDERATIONS

### **PostgreSQL Configuration (NAS optimized)**
```sql
-- postgresql.conf optimizations for NAS (4-8GB RAM)
shared_buffers = 128MB          -- 256MB if 8GB+ RAM
effective_cache_size = 1GB
random_page_cost = 1.1          -- SSD storage
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

### **Connection Pooling**
```typescript
// Use connection pooling for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Max connections for NAS
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

---

**Versión:** 2.0 (post-auditoría)  
**Actualizado:** 2026-02-10  
**Gap crítico resuelto:** Tabla property_images añadida  
**Many-to-many:** client_properties implementado  
**Ready for:** Nivel 1 - Foundation development