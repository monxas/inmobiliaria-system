-- 002_create_properties.sql

CREATE TYPE property_type AS ENUM ('house', 'apartment', 'office', 'warehouse', 'land', 'commercial');
CREATE TYPE property_status AS ENUM ('available', 'reserved', 'sold', 'rented', 'off_market');

CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'España',
  property_type property_type NOT NULL,
  status property_status NOT NULL DEFAULT 'available',
  price DECIMAL(12, 2) NOT NULL,
  surface_area INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  garage BOOLEAN DEFAULT FALSE,
  garden BOOLEAN DEFAULT FALSE,
  owner_id INTEGER REFERENCES users(id),
  agent_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT check_positive_price CHECK (price > 0)
);

CREATE TABLE property_features (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  feature_value TEXT,
  UNIQUE(property_id, feature_key)
);
