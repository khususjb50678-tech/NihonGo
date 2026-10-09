-- Jalankan sekali di Supabase → SQL Editor
alter table public.branding add column if not exists app_name text;
alter table public.branding add column if not exists app_short_name text;
alter table public.branding add column if not exists app_icon_url text;
