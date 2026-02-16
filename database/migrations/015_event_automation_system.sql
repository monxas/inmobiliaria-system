-- =============================================================================
-- Migration 015: Event Automation System
-- Rich event types, automated reminders, follow-ups, analytics
-- =============================================================================

-- Event type enum (expandable)
DO $$ BEGIN
  CREATE TYPE event_type AS ENUM (
    'viewing',          -- Property showing
    'follow_up',        -- Post-viewing follow-up call/meeting
    'contract_signing', -- Contract signing appointment
    'key_handover',     -- Key delivery
    'valuation',        -- Property valuation visit
    'open_house',       -- Open house event
    'consultation',     -- Initial client consultation
    'inspection',       -- Property inspection
    'negotiation',      -- Price negotiation meeting
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event status enum
DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
    'draft',
    'scheduled',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reminder status enum
DO $$ BEGIN
  CREATE TYPE reminder_status AS ENUM (
    'pending',
    'sent',
    'failed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reminder channel enum
DO $$ BEGIN
  CREATE TYPE reminder_channel AS ENUM (
    'email',
    'sms',
    'push',
    'in_app'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Event Templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_templates (
  id SERIAL PRIMARY KEY,
  
  -- Template identity
  name VARCHAR(100) NOT NULL UNIQUE,
  event_type event_type NOT NULL,
  description TEXT,
  
  -- Default values
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  default_location TEXT,
  default_description_template TEXT,  -- Supports {{client_name}}, {{property_address}} etc.
  
  -- Custom fields schema (JSON Schema format)
  -- Example: [{"key": "feedback_rating", "label": "Rating", "type": "number", "min": 1, "max": 5}]
  custom_fields JSONB DEFAULT '[]'::jsonb,
  
  -- Reminder presets (minutes before event)
  -- Example: [{"channel": "email", "minutes_before": 1440}, {"channel": "sms", "minutes_before": 60}]
  reminder_presets JSONB DEFAULT '[]'::jsonb,
  
  -- Follow-up rules
  -- Example: {"auto_create": true, "delay_hours": 24, "follow_up_type": "follow_up", "template_name": "post_viewing_followup"}
  follow_up_rules JSONB DEFAULT '{}'::jsonb,
  
  -- Next steps suggestions shown after event completion
  -- Example: ["Schedule follow-up call", "Send property comparison", "Prepare offer"]
  suggested_next_steps JSONB DEFAULT '[]'::jsonb,
  
  -- Color for calendar display
  color VARCHAR(7) DEFAULT '#3B82F6',
  icon VARCHAR(50) DEFAULT 'calendar',
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Events (main table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  
  -- Core fields
  title VARCHAR(500) NOT NULL,
  event_type event_type NOT NULL DEFAULT 'other',
  status event_status NOT NULL DEFAULT 'scheduled',
  template_id INTEGER REFERENCES event_templates(id) ON DELETE SET NULL,
  
  -- Scheduling
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  timezone VARCHAR(50) DEFAULT 'Europe/Madrid',
  
  -- Location
  location TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  virtual_meeting_url TEXT,
  
  -- Description & notes
  description TEXT,
  internal_notes TEXT,  -- Agent-only notes
  outcome_notes TEXT,   -- Post-event notes
  
  -- Relationships
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  
  -- Rich metadata (custom fields per event type)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Automation tracking
  parent_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,  -- For follow-ups
  auto_generated BOOLEAN NOT NULL DEFAULT false,
  
  -- Google Calendar sync
  google_event_id VARCHAR(255),
  google_calendar_id VARCHAR(255),
  
  -- Completion data
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Audit
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- =============================================================================
-- Event Attendees (multiple people per event)
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_attendees (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  
  -- Can be a client, user, or external person
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- For external attendees
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- RSVP
  rsvp_status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, declined, tentative
  
  -- Notification preferences for this event
  notify_email BOOLEAN DEFAULT true,
  notify_sms BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Event Reminders
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_reminders (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  
  -- When to send
  remind_at TIMESTAMPTZ NOT NULL,
  minutes_before INTEGER NOT NULL,  -- For reference
  
  -- How to send
  channel reminder_channel NOT NULL DEFAULT 'email',
  
  -- Target
  attendee_id INTEGER REFERENCES event_attendees(id) ON DELETE CASCADE,
  target_email VARCHAR(255),
  target_phone VARCHAR(50),
  target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Status
  status reminder_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Content (rendered from template)
  subject VARCHAR(500),
  body TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Event Analytics / Metrics
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_analytics (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Timing metrics
  time_to_complete_minutes INTEGER,  -- scheduled → completed
  prep_time_minutes INTEGER,
  
  -- Conversion tracking
  led_to_offer BOOLEAN DEFAULT false,
  led_to_contract BOOLEAN DEFAULT false,
  conversion_value DECIMAL(12, 2),  -- Estimated deal value
  
  -- Client engagement
  client_satisfaction INTEGER CHECK (client_satisfaction BETWEEN 1 AND 5),
  client_feedback TEXT,
  
  -- Follow-up tracking
  follow_up_created BOOLEAN DEFAULT false,
  follow_up_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
  days_to_follow_up INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Event Activity Log (audit trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS event_activity_log (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  
  action VARCHAR(50) NOT NULL,  -- created, updated, status_changed, reminder_sent, etc.
  old_value JSONB,
  new_value JSONB,
  
  performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  
  notes TEXT
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id);
CREATE INDEX IF NOT EXISTS idx_events_client ON events(client_id);
CREATE INDEX IF NOT EXISTS idx_events_property ON events(property_id);
CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_events_google ON events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_events_upcoming ON events(start_time, status) WHERE status IN ('scheduled', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_reminders_pending ON event_reminders(remind_at, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_event ON event_reminders(event_id);

CREATE INDEX IF NOT EXISTS idx_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_client ON event_attendees(client_id);

CREATE INDEX IF NOT EXISTS idx_activity_event ON event_activity_log(event_id);

-- =============================================================================
-- Seed default event templates
-- =============================================================================

INSERT INTO event_templates (name, event_type, description, default_duration_minutes, default_description_template, custom_fields, reminder_presets, follow_up_rules, suggested_next_steps, color, icon, is_system)
VALUES
  (
    'property_viewing',
    'viewing',
    'Standard property viewing with client',
    45,
    'Property viewing at {{property_address}} with {{client_name}}',
    '[
      {"key": "viewing_type", "label": "Viewing Type", "type": "select", "options": ["first_visit", "second_visit", "final_visit"]},
      {"key": "client_interest_level", "label": "Interest Level", "type": "number", "min": 1, "max": 10},
      {"key": "objections", "label": "Client Objections", "type": "text"},
      {"key": "liked_features", "label": "Liked Features", "type": "text"}
    ]'::jsonb,
    '[
      {"channel": "email", "minutes_before": 1440},
      {"channel": "sms", "minutes_before": 120},
      {"channel": "in_app", "minutes_before": 60},
      {"channel": "push", "minutes_before": 30}
    ]'::jsonb,
    '{"auto_create": true, "delay_hours": 24, "follow_up_type": "follow_up", "template_name": "post_viewing_followup"}'::jsonb,
    '["Schedule follow-up call within 24h", "Send property comparison document", "Check client financing status", "Prepare counter-offer if interested"]'::jsonb,
    '#3B82F6',
    'eye',
    true
  ),
  (
    'post_viewing_followup',
    'follow_up',
    'Follow-up call/meeting after property viewing',
    30,
    'Follow-up with {{client_name}} regarding {{property_address}} viewing',
    '[
      {"key": "follow_up_method", "label": "Method", "type": "select", "options": ["phone", "in_person", "video_call", "email"]},
      {"key": "client_decision", "label": "Client Decision", "type": "select", "options": ["interested", "needs_time", "not_interested", "wants_offer"]},
      {"key": "next_action", "label": "Next Action", "type": "text"}
    ]'::jsonb,
    '[
      {"channel": "in_app", "minutes_before": 60},
      {"channel": "push", "minutes_before": 15}
    ]'::jsonb,
    '{}'::jsonb,
    '["Schedule second viewing if interested", "Send additional property options", "Prepare offer documents", "Archive lead if not interested"]'::jsonb,
    '#10B981',
    'phone',
    true
  ),
  (
    'contract_signing',
    'contract_signing',
    'Contract signing appointment',
    90,
    'Contract signing for {{property_address}} with {{client_name}}',
    '[
      {"key": "contract_type", "label": "Contract Type", "type": "select", "options": ["reservation", "purchase", "rental", "option"]},
      {"key": "agreed_price", "label": "Agreed Price", "type": "number"},
      {"key": "notary_required", "label": "Notary Required", "type": "boolean"},
      {"key": "documents_ready", "label": "Documents Ready", "type": "boolean"}
    ]'::jsonb,
    '[
      {"channel": "email", "minutes_before": 2880},
      {"channel": "sms", "minutes_before": 1440},
      {"channel": "email", "minutes_before": 120},
      {"channel": "push", "minutes_before": 60}
    ]'::jsonb,
    '{"auto_create": true, "delay_hours": 1, "follow_up_type": "key_handover", "template_name": "key_handover"}'::jsonb,
    '["Schedule key handover", "Send congratulations email", "Update property status to sold/rented", "Process commission"]'::jsonb,
    '#8B5CF6',
    'file-signature',
    true
  ),
  (
    'key_handover',
    'key_handover',
    'Key delivery to new owner/tenant',
    30,
    'Key handover for {{property_address}} to {{client_name}}',
    '[
      {"key": "keys_count", "label": "Number of Keys", "type": "number"},
      {"key": "meter_readings", "label": "Meter Readings", "type": "text"},
      {"key": "condition_notes", "label": "Property Condition Notes", "type": "text"}
    ]'::jsonb,
    '[
      {"channel": "email", "minutes_before": 1440},
      {"channel": "sms", "minutes_before": 120}
    ]'::jsonb,
    '{}'::jsonb,
    '["Send welcome package", "Set up utility transfers", "Request Google review", "Close deal in system"]'::jsonb,
    '#F59E0B',
    'key',
    true
  ),
  (
    'property_valuation',
    'valuation',
    'Property valuation visit',
    60,
    'Property valuation at {{property_address}}',
    '[
      {"key": "estimated_value", "label": "Estimated Value", "type": "number"},
      {"key": "property_condition", "label": "Condition", "type": "select", "options": ["excellent", "good", "fair", "needs_work"]},
      {"key": "comparable_properties", "label": "Comparable Properties", "type": "text"},
      {"key": "recommended_listing_price", "label": "Recommended Price", "type": "number"}
    ]'::jsonb,
    '[
      {"channel": "email", "minutes_before": 1440},
      {"channel": "push", "minutes_before": 60}
    ]'::jsonb,
    '{"auto_create": true, "delay_hours": 48, "follow_up_type": "follow_up", "template_name": "post_viewing_followup"}'::jsonb,
    '["Send valuation report to owner", "Propose listing agreement", "Schedule professional photography", "Create property listing"]'::jsonb,
    '#EF4444',
    'calculator',
    true
  ),
  (
    'open_house',
    'open_house',
    'Open house event for property',
    180,
    'Open house at {{property_address}}',
    '[
      {"key": "visitor_count", "label": "Number of Visitors", "type": "number"},
      {"key": "interested_leads", "label": "Interested Leads", "type": "number"},
      {"key": "marketing_channels", "label": "Marketing Channels Used", "type": "text"}
    ]'::jsonb,
    '[
      {"channel": "email", "minutes_before": 4320},
      {"channel": "email", "minutes_before": 1440},
      {"channel": "sms", "minutes_before": 120}
    ]'::jsonb,
    '{}'::jsonb,
    '["Follow up with all visitors within 48h", "Send property details to interested leads", "Schedule individual viewings", "Update marketing report"]'::jsonb,
    '#EC4899',
    'users',
    true
  ),
  (
    'client_consultation',
    'consultation',
    'Initial client consultation meeting',
    60,
    'Consultation with {{client_name}}',
    '[
      {"key": "client_type", "label": "Client Type", "type": "select", "options": ["buyer", "seller", "investor", "tenant"]},
      {"key": "budget_range", "label": "Budget Range", "type": "text"},
      {"key": "requirements", "label": "Requirements", "type": "text"},
      {"key": "timeline", "label": "Timeline", "type": "text"}
    ]'::jsonb,
    '[
      {"channel": "email", "minutes_before": 1440},
      {"channel": "push", "minutes_before": 30}
    ]'::jsonb,
    '{"auto_create": true, "delay_hours": 2, "follow_up_type": "follow_up", "template_name": "post_viewing_followup"}'::jsonb,
    '["Send property recommendations", "Schedule first viewings", "Prepare market analysis", "Set up property alerts"]'::jsonb,
    '#06B6D4',
    'user-plus',
    true
  )
ON CONFLICT (name) DO NOTHING;
