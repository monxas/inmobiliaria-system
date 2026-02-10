-- 009_seed_basic_data.sql
-- Basic seed data for initial setup

-- Insert default admin user (password: 'admin123' bcrypt hash)
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO users (email, password_hash, role, full_name)
VALUES (
  'admin@inmobiliaria.local',
  '$2a$12$LJ3m5Fqx6RQX8VyFG1SQOeR.GQHlP3K2f8gQkYk6p0fNz7gZLmKaG',
  'admin',
  'Administrador'
) ON CONFLICT (email) DO NOTHING;

-- Insert sample property types reference (via enum, already in schema)
-- Insert sample email templates
INSERT INTO email_templates (template_key, subject_template, body_template)
VALUES
  ('welcome', 'Bienvenido a Inmobiliaria', 'Hola {{name}}, bienvenido a nuestra plataforma.'),
  ('viewing_scheduled', 'Visita programada: {{property}}', 'Se ha programado una visita para {{date}} en {{property}}.'),
  ('document_shared', 'Documento compartido', 'Se ha compartido el documento {{document}} contigo.')
ON CONFLICT (template_key) DO NOTHING;
