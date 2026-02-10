-- 006_create_documents.sql

CREATE TYPE file_category AS ENUM ('property_docs', 'property_images', 'client_docs', 'contracts', 'other');

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  category file_category NOT NULL DEFAULT 'other',
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  access_token VARCHAR(255) UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  download_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT check_token_if_expires CHECK (expires_at IS NULL OR access_token IS NOT NULL)
);

CREATE TABLE file_access_logs (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  accessed_by INTEGER REFERENCES users(id),
  ip_address INET NOT NULL,
  user_agent TEXT,
  access_token_used VARCHAR(255),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
