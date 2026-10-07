-- Tambahan untuk fitur Pesan & Maintenance.
-- Jalankan SEKALI di Supabase SQL Editor.

ALTER TABLE public.branding
  ADD COLUMN IF NOT EXISTS message_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS message_title text,
  ADD COLUMN IF NOT EXISTS message_body text,
  ADD COLUMN IF NOT EXISTS maintenance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maintenance_title text,
  ADD COLUMN IF NOT EXISTS maintenance_body text;

NOTIFY pgrst, 'reload schema';
