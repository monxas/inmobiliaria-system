-- Migration 015: WhatsApp & Communications System
-- Adds tables for WhatsApp messaging, push subscriptions, communication logs

-- =============================================================================
-- WhatsApp Session Storage
-- =============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  session_data JSONB,
  is_active BOOLEAN NOT NULL DEFAULT false,
  phone_number VARCHAR(20),
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Communication Log (unified: WhatsApp, SMS, Email, Push)
-- =============================================================================
CREATE TYPE communication_channel AS ENUM ('whatsapp', 'sms', 'email', 'push', 'call');
CREATE TYPE communication_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed', 'expired');
CREATE TYPE communication_type AS ENUM (
  'appointment_confirmation', 'appointment_reminder', 'appointment_followup',
  'viewing_confirmation', 'viewing_reminder', 'viewing_followup',
  'document_shared', 'general', 'custom'
);

CREATE TABLE IF NOT EXISTS communication_logs (
  id SERIAL PRIMARY KEY,
  
  -- Who
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- agent who triggered
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  recipient_name VARCHAR(255),
  
  -- What
  channel communication_channel NOT NULL,
  type communication_type NOT NULL DEFAULT 'general',
  subject VARCHAR(500),
  message TEXT NOT NULL,
  template_name VARCHAR(100),
  template_data JSONB,
  
  -- Context
  event_id VARCHAR(255),  -- Google Calendar event ID
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  viewing_id INTEGER REFERENCES property_viewings(id) ON DELETE SET NULL,
  
  -- Status
  status communication_status NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Fallback tracking
  fallback_from INTEGER REFERENCES communication_logs(id),  -- if this was a fallback
  fallback_channel communication_channel,  -- original intended channel
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- Provider data
  provider_message_id VARCHAR(255),
  provider_response JSONB,
  
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comm_logs_client ON communication_logs(client_id);
CREATE INDEX idx_comm_logs_channel ON communication_logs(channel);
CREATE INDEX idx_comm_logs_status ON communication_logs(status);
CREATE INDEX idx_comm_logs_event ON communication_logs(event_id);
CREATE INDEX idx_comm_logs_created ON communication_logs(created_at);

-- =============================================================================
-- Push Notification Subscriptions (Web Push)
-- =============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent VARCHAR(500),
  device_name VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

-- =============================================================================
-- Message Templates (for WhatsApp/SMS)
-- =============================================================================
CREATE TABLE IF NOT EXISTS message_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  channel communication_channel NOT NULL DEFAULT 'whatsapp',
  type communication_type NOT NULL,
  
  -- Template content (supports {{variable}} placeholders)
  subject VARCHAR(500),
  body TEXT NOT NULL,
  
  -- Language
  language VARCHAR(10) NOT NULL DEFAULT 'es',
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Default Message Templates
-- =============================================================================
INSERT INTO message_templates (name, channel, type, subject, body, language, is_system) VALUES
('whatsapp_viewing_confirmation', 'whatsapp', 'viewing_confirmation', NULL,
 '¡Hola {{clientName}}! 👋

Su visita a la propiedad en *{{propertyAddress}}* ha sido confirmada para:

📅 *{{date}}* a las *{{time}}*
📍 {{location}}
👤 Le atenderá: {{agentName}}

Si necesita cambiar la cita, responda a este mensaje o llame al {{agentPhone}}.

¡Le esperamos! 🏠',
 'es', true),

('whatsapp_viewing_reminder', 'whatsapp', 'viewing_reminder', NULL,
 '⏰ *Recordatorio de visita*

Hola {{clientName}}, le recordamos su visita programada:

📅 *{{date}}* a las *{{time}}*
📍 {{propertyAddress}}
👤 Agente: {{agentName}}

¿Confirma su asistencia? Responda ✅ o ❌',
 'es', true),

('whatsapp_viewing_followup', 'whatsapp', 'viewing_followup', NULL,
 'Hola {{clientName}} 👋

¿Qué le pareció la visita a *{{propertyAddress}}*? 🏠

Nos encantaría conocer su opinión. Si tiene alguna pregunta o quiere agendar otra visita, no dude en escribirnos.

Un saludo,
{{agentName}}',
 'es', true),

('sms_viewing_confirmation', 'sms', 'viewing_confirmation', NULL,
 'Visita confirmada: {{propertyAddress}} el {{date}} a las {{time}}. Agente: {{agentName}}. Info: {{agentPhone}}',
 'es', true),

('sms_viewing_reminder', 'sms', 'viewing_reminder', NULL,
 'Recordatorio: Visita mañana {{date}} {{time}} en {{propertyAddress}}. Agente: {{agentName}}. Confirme respondiendo SI/NO',
 'es', true),

('push_new_viewing', 'push', 'viewing_confirmation', 'Nueva visita programada',
 'Visita con {{clientName}} en {{propertyAddress}} - {{date}} {{time}}',
 'es', true),

('push_viewing_reminder', 'push', 'viewing_reminder', 'Visita en {{minutesBefore}} minutos',
 'Visita con {{clientName}} en {{propertyAddress}}',
 'es', true)

ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- Scheduled Communications (for reminders, follow-ups)
-- =============================================================================
CREATE TABLE IF NOT EXISTS scheduled_communications (
  id SERIAL PRIMARY KEY,
  
  -- Template reference
  template_name VARCHAR(100) REFERENCES message_templates(name),
  template_data JSONB,
  
  -- Target
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(20),
  
  -- Schedule
  scheduled_at TIMESTAMPTZ NOT NULL,
  channel communication_channel NOT NULL DEFAULT 'whatsapp',
  
  -- Context
  event_id VARCHAR(255),
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  viewing_id INTEGER REFERENCES property_viewings(id) ON DELETE SET NULL,
  
  -- Status
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  communication_log_id INTEGER REFERENCES communication_logs(id),
  
  -- Cancellation
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sched_comm_scheduled ON scheduled_communications(scheduled_at) WHERE NOT is_sent AND NOT is_cancelled;
CREATE INDEX idx_sched_comm_event ON scheduled_communications(event_id);
