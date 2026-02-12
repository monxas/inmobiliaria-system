-- Migration 014: Google Calendar Integration
-- Stores OAuth2 tokens and event cache for Google Calendar sync

BEGIN;

-- OAuth2 tokens per user
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    scope TEXT,
    expiry_date BIGINT NOT NULL, -- Unix timestamp ms
    calendar_id VARCHAR(255) DEFAULT 'primary',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Cached calendar events for fast dashboard loading
CREATE TABLE IF NOT EXISTS calendar_events_cache (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    google_event_id VARCHAR(255) NOT NULL,
    calendar_id VARCHAR(255) DEFAULT 'primary',
    summary TEXT,
    description TEXT,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'confirmed',
    -- Inmobiliaria-specific metadata
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    event_type VARCHAR(50) DEFAULT 'viewing', -- viewing, meeting, signing, other
    html_link TEXT,
    sync_token TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, google_event_id)
);

CREATE INDEX idx_calendar_events_user_time ON calendar_events_cache(user_id, start_time, end_time);
CREATE INDEX idx_calendar_events_property ON calendar_events_cache(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_calendar_events_client ON calendar_events_cache(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_calendar_tokens_user ON google_calendar_tokens(user_id);

COMMIT;
