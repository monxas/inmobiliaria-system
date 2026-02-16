-- 015_enhance_clients_crm.sql
-- CRM Enhancement: 25+ new fields for professional client management

-- Client status enum for CRM pipeline
DO $$ BEGIN
  CREATE TYPE client_status AS ENUM ('lead', 'contacted', 'qualified', 'negotiating', 'closed', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Client source enum
DO $$ BEGIN
  CREATE TYPE client_source AS ENUM ('website', 'referral', 'walk_in', 'phone', 'social_media', 'portal', 'advertising', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Preferred contact method enum
DO $$ BEGIN
  CREATE TYPE contact_method AS ENUM ('phone', 'email', 'whatsapp', 'in_person');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Property interest type enum
DO $$ BEGIN
  CREATE TYPE interest_type AS ENUM ('buy', 'rent', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add CRM fields to clients table
ALTER TABLE clients
  -- CRM Pipeline
  ADD COLUMN IF NOT EXISTS status client_status DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS source client_source DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  
  -- Personal Info
  ADD COLUMN IF NOT EXISTS dni VARCHAR(20),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(255),
  ADD COLUMN IF NOT EXISTS company VARCHAR(255),
  
  -- Contact Preferences
  ADD COLUMN IF NOT EXISTS phone_secondary VARCHAR(50),
  ADD COLUMN IF NOT EXISTS preferred_contact contact_method DEFAULT 'phone',
  ADD COLUMN IF NOT EXISTS preferred_contact_time VARCHAR(50),  -- e.g. 'morning', 'afternoon', 'evening'
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Madrid',
  ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'es',
  
  -- Property Preferences
  ADD COLUMN IF NOT EXISTS interest_type interest_type DEFAULT 'buy',
  ADD COLUMN IF NOT EXISTS budget_min DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS budget_max DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS preferred_zones TEXT,            -- JSON array of preferred areas/zones
  ADD COLUMN IF NOT EXISTS preferred_property_types TEXT,   -- JSON array of property types
  ADD COLUMN IF NOT EXISTS min_bedrooms INTEGER,
  ADD COLUMN IF NOT EXISTS min_bathrooms INTEGER,
  ADD COLUMN IF NOT EXISTS min_surface INTEGER,
  ADD COLUMN IF NOT EXISTS needs_garage BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_garden BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS additional_requirements TEXT,
  
  -- Engagement & Scoring
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS total_viewings INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_contacts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags TEXT;  -- JSON array of tags

-- Client interactions table (replaces JSON-in-notes approach)
CREATE TABLE IF NOT EXISTS client_interactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES users(id),
  interaction_type VARCHAR(50) NOT NULL,  -- call, email, meeting, whatsapp, visit, note
  summary TEXT NOT NULL,
  details TEXT,
  outcome VARCHAR(100),  -- positive, neutral, negative, no_answer
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_interactions_client ON client_interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_date ON client_interactions(created_at DESC);

-- Client property matches (suggested properties based on preferences)
CREATE TABLE IF NOT EXISTS client_property_matches (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons TEXT,  -- JSON array of reasons
  status VARCHAR(50) DEFAULT 'suggested',  -- suggested, viewed, rejected, interested
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_client_property_match UNIQUE (client_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_client_property_matches_client ON client_property_matches(client_id);
CREATE INDEX IF NOT EXISTS idx_client_property_matches_score ON client_property_matches(match_score DESC);

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_lead_score ON clients(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_clients_next_followup ON clients(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_last_contact ON clients(last_contact_at DESC);
