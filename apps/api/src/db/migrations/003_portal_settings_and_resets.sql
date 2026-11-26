-- ==============================================================================
-- 003_portal_settings_and_resets.sql
-- Adds persistent portal_settings and password_reset_tokens tables
-- ==============================================================================

CREATE TABLE IF NOT EXISTS portal_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  portal_title VARCHAR(180) NOT NULL DEFAULT 'Mobileum Sales Demo Portal',
  default_sort VARCHAR(32) NOT NULL DEFAULT 'display_order' CHECK (default_sort IN ('display_order', 'recent', 'alpha')),
  max_image_size_mb INTEGER NOT NULL DEFAULT 15 CHECK (max_image_size_mb BETWEEN 1 AND 100),
  max_video_size_mb INTEGER NOT NULL DEFAULT 500 CHECK (max_video_size_mb BETWEEN 10 AND 2048),
  allowed_image_types TEXT[] NOT NULL DEFAULT ARRAY['image/png', 'image/jpeg', 'image/webp'],
  allowed_video_types TEXT[] NOT NULL DEFAULT ARRAY['video/mp4'],
  session_ttl_hours INTEGER NOT NULL DEFAULT 12 CHECK (session_ttl_hours BETWEEN 1 AND 168),
  updated_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO portal_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (admin_user_id, expires_at);
