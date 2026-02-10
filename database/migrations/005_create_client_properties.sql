-- 005_create_client_properties.sql

CREATE TYPE client_property_relationship AS ENUM ('interested', 'viewing', 'offer_made', 'contracted');

CREATE TABLE client_properties (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  relationship_type client_property_relationship NOT NULL DEFAULT 'interested',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_client_property UNIQUE (client_id, property_id)
);
